import { randomInt } from "node:crypto";
import {
  CLASS_ERROR_CODES,
  type ClassCourseOptionsView,
  type ClassCourseRef,
  type ClassEnrollmentState,
  type ClassJoinPreview,
  type ClassJoinState,
  type ClassSummary,
  type JoinClassResult,
  type MyClassesView,
  type TeachClassDetail,
  type TeachClassesView,
} from "../../shared/api/classes.js";
import { prisma } from "../../db/prisma.js";
import type { EnrollmentLifecycle, Prisma } from "../../generated/prisma/index.js";
import type { SessionUser } from "../../types/auth.js";
import { ConflictError, NotFoundError, UnprocessableError } from "../../utils/errors.js";
import { appBaseUrl } from "../email/send.js";
import { CONFIRMED_ENROLLMENT_WHERE } from "../enrollment/lifecycle.js";
import { selfEnroll } from "../enrollment/self-enroll.js";

// A class is a teacher's named group of learners. Learners join with a code, which
// gives the teacher sight of their progress in the class's courses and nothing else.
// A class never grants access to a paid course: the learner still buys it, or an
// organisation allocation covers it, through the usual enrollment paths.

// No 0/O, 1/I/L: the code is read aloud and typed by hand.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

const courseRefSelect = { id: true, slug: true, title: true, pricingType: true, priceCents: true, currency: true } as const;

export function classJoinUrl(joinCode: string): string {
  return `${appBaseUrl()}/join/${joinCode}`;
}

function newJoinCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** A code no class uses yet. Collisions are rare (31^8), so a few tries always suffice. */
async function uniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = newJoinCode();
    if (!(await prisma.teachingClass.findUnique({ where: { joinCode: code }, select: { id: true } }))) return code;
  }
  throw new ConflictError("Could not make a join code. Try again.");
}

const iso = (value: Date | null) => value?.toISOString() ?? null;
const toDate = (value: string | null | undefined) => (value === undefined ? undefined : value === null ? null : new Date(value));

/** 404 for a class that does not exist or belongs to another teacher: its existence is not their business. */
export async function requireOwnClass(user: SessionUser, classId: string) {
  const found = await prisma.teachingClass.findFirst({ where: { id: classId, teacherId: user.id } });
  if (!found) throw new NotFoundError("Class not found");
  return found;
}

/** Every id must be a published course; returns them in the order given. */
async function loadClassCourses(courseIds: string[]): Promise<ClassCourseRef[]> {
  const unique = [...new Set(courseIds)];
  const courses = await prisma.course.findMany({ where: { id: { in: unique }, status: "PUBLISHED" }, select: courseRefSelect });
  if (courses.length !== unique.length) {
    throw new UnprocessableError("One of these courses is not published, so it cannot be added to a class.", CLASS_ERROR_CODES.COURSE_NOT_AVAILABLE);
  }
  const byId = new Map(courses.map((course) => [course.id, course]));
  return unique.map((id) => byId.get(id)!);
}

const summarySelect = {
  id: true, name: true, joinCode: true, startsAt: true, endsAt: true, archivedAt: true, createdAt: true,
  _count: { select: { members: true } },
  courses: { orderBy: { order: "asc" }, select: { course: { select: { id: true, slug: true, title: true } } } },
} satisfies Prisma.TeachingClassSelect;

type SummaryRow = Prisma.TeachingClassGetPayload<{ select: typeof summarySelect }>;

function toSummary(row: SummaryRow): ClassSummary {
  return {
    id: row.id,
    name: row.name,
    joinCode: row.joinCode,
    joinUrl: classJoinUrl(row.joinCode),
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    archived: row.archivedAt !== null,
    memberCount: row._count.members,
    courses: row.courses.map((item) => item.course),
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Teacher ─────────────────────────────────────────────────────────────────

export async function listTeacherClasses(user: SessionUser): Promise<TeachClassesView> {
  const rows = await prisma.teachingClass.findMany({
    where: { teacherId: user.id },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    select: summarySelect,
  });
  return { classes: rows.map(toSummary) };
}

/** Courses a teacher can build a class from: everything published in the catalog. */
export async function listClassCourseOptions(): Promise<ClassCourseOptionsView> {
  const courses = await prisma.course.findMany({ where: { status: "PUBLISHED" }, orderBy: { title: "asc" }, select: courseRefSelect });
  return { courses };
}

export async function createClass(
  user: SessionUser,
  input: { name: string; courseIds: string[]; startsAt?: string | null; endsAt?: string | null }
): Promise<ClassSummary> {
  const courses = await loadClassCourses(input.courseIds);
  const row = await prisma.teachingClass.create({
    data: {
      name: input.name,
      joinCode: await uniqueJoinCode(),
      teacherId: user.id,
      startsAt: toDate(input.startsAt) ?? null,
      endsAt: toDate(input.endsAt) ?? null,
      courses: { create: courses.map((course, order) => ({ courseId: course.id, order })) },
    },
    select: summarySelect,
  });
  return toSummary(row);
}

export async function updateClass(
  user: SessionUser,
  classId: string,
  input: { name?: string; courseIds?: string[]; startsAt?: string | null; endsAt?: string | null; archived?: boolean }
): Promise<ClassSummary> {
  const owned = await requireOwnClass(user, classId);
  const startsAt = input.startsAt === undefined ? owned.startsAt : toDate(input.startsAt)!;
  const endsAt = input.endsAt === undefined ? owned.endsAt : toDate(input.endsAt)!;
  if (startsAt && endsAt && endsAt <= startsAt) throw new UnprocessableError("The end date must be after the start date.");
  const courses = input.courseIds ? await loadClassCourses(input.courseIds) : null;

  const row = await prisma.$transaction(async (tx) => {
    if (courses) {
      const keep = courses.map((course) => course.id);
      await tx.teachingClassCourse.deleteMany({ where: { classId, courseId: { notIn: keep } } });
      // A due date only means something while its course is still part of the class.
      await tx.teachingClassDueDate.deleteMany({ where: { classId, module: { courseId: { notIn: keep } } } });
      for (const [order, course] of courses.entries()) {
        await tx.teachingClassCourse.upsert({
          where: { classId_courseId: { classId, courseId: course.id } },
          create: { classId, courseId: course.id, order },
          update: { order },
        });
      }
    }
    return tx.teachingClass.update({
      where: { id: classId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.startsAt !== undefined ? { startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt } : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? (owned.archivedAt ?? new Date()) : null } : {}),
      },
      select: summarySelect,
    });
  });
  return toSummary(row);
}

/** A new code. The old one stops working at once; current members stay. */
export async function rotateClassCode(user: SessionUser, classId: string): Promise<ClassSummary> {
  await requireOwnClass(user, classId);
  const row = await prisma.teachingClass.update({ where: { id: classId }, data: { joinCode: await uniqueJoinCode() }, select: summarySelect });
  return toSummary(row);
}

export async function setClassDueDates(
  user: SessionUser,
  classId: string,
  items: Array<{ moduleId: string; dueAt: string | null }>
): Promise<TeachClassDetail> {
  await requireOwnClass(user, classId);
  const moduleIds = [...new Set(items.map((item) => item.moduleId))];
  const inClass = await prisma.module.count({
    where: { id: { in: moduleIds }, archivedAt: null, course: { classCourses: { some: { classId } } } },
  });
  if (inClass !== moduleIds.length) {
    throw new UnprocessableError("One of these modules is not part of this class's courses.", CLASS_ERROR_CODES.MODULE_NOT_IN_CLASS);
  }
  await prisma.$transaction(
    items.map((item) =>
      item.dueAt === null
        ? prisma.teachingClassDueDate.deleteMany({ where: { classId, moduleId: item.moduleId } })
        : prisma.teachingClassDueDate.upsert({
            where: { classId_moduleId: { classId, moduleId: item.moduleId } },
            create: { classId, moduleId: item.moduleId, dueAt: new Date(item.dueAt) },
            update: { dueAt: new Date(item.dueAt) },
          })
    )
  );
  return loadTeacherClass(user, classId);
}

export async function removeClassMember(user: SessionUser, classId: string, userId: string): Promise<void> {
  await requireOwnClass(user, classId);
  const removed = await prisma.teachingClassMember.deleteMany({ where: { classId, userId } });
  if (!removed.count) throw new NotFoundError("That learner is not in this class.");
}

const enrollmentStateSelect = {
  userId: true, courseId: true, lifecycle: true, status: true, percentComplete: true, lastActiveAt: true,
  payment: { select: { status: true } },
} satisfies Prisma.EnrollmentSelect;

type EnrollmentStateRow = Prisma.EnrollmentGetPayload<{ select: typeof enrollmentStateSelect }>;

const NOT_ENROLLED = { state: "not-enrolled", percentComplete: 0, lastActiveAt: null } as const;

/** Where a learner stands in one course. Progress is only reported for a confirmed enrollment. */
function describeEnrollment(row: EnrollmentStateRow | undefined): { state: ClassEnrollmentState; percentComplete: number; lastActiveAt: string | null } {
  if (!row) return NOT_ENROLLED;
  if (row.lifecycle === "PAYMENT_REQUIRED") return { ...NOT_ENROLLED, state: "payment-required" };
  const confirmed: EnrollmentLifecycle[] = ["ACTIVE", "COMPLETED"];
  const settled = !row.payment || row.payment.status === "SUCCEEDED";
  if (!settled || !confirmed.includes(row.lifecycle)) return NOT_ENROLLED;
  return {
    state: row.status === "COMPLETED" || row.lifecycle === "COMPLETED" ? "completed" : "active",
    percentComplete: row.percentComplete,
    lastActiveAt: iso(row.lastActiveAt),
  };
}

/** The class with its courses, their modules and due dates, and the roster. */
export async function loadTeacherClass(user: SessionUser, classId: string): Promise<TeachClassDetail> {
  await requireOwnClass(user, classId);
  const row = await prisma.teachingClass.findUniqueOrThrow({
    where: { id: classId },
    select: {
      ...summarySelect,
      dueDates: { select: { moduleId: true, dueAt: true } },
      courses: {
        orderBy: { order: "asc" },
        select: {
          course: {
            select: {
              ...courseRefSelect,
              modules: { where: { archivedAt: null }, orderBy: { order: "asc" }, select: { id: true, title: true, order: true } },
            },
          },
        },
      },
      members: {
        orderBy: { joinedAt: "asc" },
        select: { userId: true, joinedAt: true, user: { select: { name: true, email: true, image: true } } },
      },
    },
  });

  const courseIds = row.courses.map((item) => item.course.id);
  const memberIds = row.members.map((member) => member.userId);
  const enrollments = memberIds.length
    ? await prisma.enrollment.findMany({ where: { courseId: { in: courseIds }, userId: { in: memberIds } }, select: enrollmentStateSelect })
    : [];
  const byLearnerCourse = new Map(enrollments.map((item) => [`${item.userId}:${item.courseId}`, item]));
  const dueByModule = new Map(row.dueDates.map((item) => [item.moduleId, item.dueAt]));

  return {
    ...toSummary({ ...row, courses: row.courses.map((item) => ({ course: { id: item.course.id, slug: item.course.slug, title: item.course.title } })) }),
    courses: row.courses.map(({ course }) => ({
      id: course.id, slug: course.slug, title: course.title,
      pricingType: course.pricingType, priceCents: course.priceCents, currency: course.currency,
      modules: course.modules.map((module) => ({ ...module, dueAt: iso(dueByModule.get(module.id) ?? null) })),
    })),
    members: row.members.map((member) => ({
      userId: member.userId,
      name: member.user.name ?? member.user.email ?? "Unnamed learner",
      email: member.user.email,
      image: member.user.image,
      joinedAt: member.joinedAt.toISOString(),
      courses: courseIds.map((courseId) => ({ courseId, ...describeEnrollment(byLearnerCourse.get(`${member.userId}:${courseId}`)) })),
    })),
  };
}

// ─── Learner ─────────────────────────────────────────────────────────────────

const joinSelect = {
  id: true, name: true, teacherId: true, startsAt: true, endsAt: true, archivedAt: true,
  teacher: { select: { name: true } },
  courses: { orderBy: { order: "asc" }, select: { course: { select: { ...courseRefSelect, status: true } } } },
} satisfies Prisma.TeachingClassSelect;

type JoinRow = Prisma.TeachingClassGetPayload<{ select: typeof joinSelect }>;

function joinState(row: JoinRow, now = new Date()): ClassJoinState {
  if (row.archivedAt) return "archived";
  if (row.endsAt && row.endsAt <= now) return "ended";
  return "open";
}

async function findByCode(code: string): Promise<JoinRow> {
  const row = await prisma.teachingClass.findUnique({ where: { joinCode: code.toUpperCase() }, select: joinSelect });
  if (!row) throw new NotFoundError("No class uses this code. Check it with your teacher.");
  return row;
}

const publishedCourses = (row: JoinRow): ClassCourseRef[] =>
  row.courses.flatMap(({ course: { status, ...course } }) => (status === "PUBLISHED" ? [course] : []));

/** Public: what the code leads to, so a learner can decide before signing in. */
export async function getClassJoinPreview(code: string): Promise<ClassJoinPreview> {
  const row = await findByCode(code);
  return {
    state: joinState(row),
    class: { id: row.id, name: row.name, teacherName: row.teacher.name, startsAt: iso(row.startsAt), endsAt: iso(row.endsAt) },
    courses: publishedCourses(row),
  };
}

/**
 * Adds the learner to the class and enrols them in its free courses. Paid courses
 * are left for the learner to buy. Joining twice is harmless.
 */
export async function joinClass(user: SessionUser, code: string): Promise<JoinClassResult> {
  const row = await findByCode(code);
  const state = joinState(row);
  if (state === "archived") throw new ConflictError("This class is closed to new learners.", CLASS_ERROR_CODES.CLASS_ARCHIVED);
  if (state === "ended") throw new ConflictError("This class has ended.", CLASS_ERROR_CODES.CLASS_ENDED);
  if (row.teacherId === user.id) throw new ConflictError("You teach this class, so you cannot join it as a learner.", CLASS_ERROR_CODES.OWN_CLASS);

  await prisma.teachingClassMember.upsert({
    where: { classId_userId: { classId: row.id, userId: user.id } },
    create: { classId: row.id, userId: user.id },
    update: {},
  });

  const courses = publishedCourses(row);
  for (const course of courses) {
    if (course.pricingType !== "FREE") continue;
    try {
      await selfEnroll(user.id, course.id);
    } catch (error) {
      // Already in the course (or part-way through a checkout): the class simply picks that up.
      if (!(error instanceof ConflictError)) throw error;
    }
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id, courseId: { in: courses.map((course) => course.id) } },
    select: enrollmentStateSelect,
  });
  const byCourse = new Map(enrollments.map((item) => [item.courseId, item]));
  return {
    classId: row.id,
    courses: courses.map((course) => ({ courseId: course.id, slug: course.slug, title: course.title, state: describeEnrollment(byCourse.get(course.id)).state })),
  };
}

export async function leaveClass(user: SessionUser, classId: string): Promise<void> {
  const removed = await prisma.teachingClassMember.deleteMany({ where: { classId, userId: user.id } });
  if (!removed.count) throw new NotFoundError("You are not in this class.");
}

/** The learner's classes with where they stand in each course and what is due. */
export async function listMyClasses(user: SessionUser): Promise<MyClassesView> {
  const memberships = await prisma.teachingClassMember.findMany({
    where: { userId: user.id, class: { archivedAt: null } },
    orderBy: { joinedAt: "desc" },
    select: {
      joinedAt: true,
      class: {
        select: {
          ...joinSelect,
          dueDates: { orderBy: { dueAt: "asc" }, select: { dueAt: true, module: { select: { id: true, title: true, courseId: true } } } },
        },
      },
    },
  });
  if (!memberships.length) return { classes: [] };

  const courseIds = [...new Set(memberships.flatMap((item) => item.class.courses.map(({ course }) => course.id)))];
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id, courseId: { in: courseIds } },
    select: { ...enrollmentStateSelect, id: true },
  });
  const byCourse = new Map(enrollments.map((item) => [item.courseId, item]));

  // A module is done when every published chapter in it is complete for this learner.
  const dueModuleIds = [...new Set(memberships.flatMap((item) => item.class.dueDates.map((due) => due.module.id)))];
  const [chapters, completed] = dueModuleIds.length
    ? await Promise.all([
        prisma.chapter.findMany({ where: { moduleId: { in: dueModuleIds }, archivedAt: null, publishedAt: { not: null } }, select: { id: true, moduleId: true } }),
        prisma.chapterProgress.findMany({
          where: { status: "COMPLETED", chapter: { moduleId: { in: dueModuleIds } }, enrollment: { userId: user.id, ...CONFIRMED_ENROLLMENT_WHERE } },
          select: { chapterId: true },
        }),
      ])
    : [[], []];
  const completedIds = new Set(completed.map((item) => item.chapterId));
  const chaptersByModule = new Map<string, string[]>();
  for (const chapter of chapters) {
    if (!chapter.moduleId) continue;
    chaptersByModule.set(chapter.moduleId, [...(chaptersByModule.get(chapter.moduleId) ?? []), chapter.id]);
  }
  const moduleDone = (moduleId: string) => {
    const ids = chaptersByModule.get(moduleId) ?? [];
    return ids.length > 0 && ids.every((id) => completedIds.has(id));
  };

  return {
    classes: memberships.map(({ joinedAt, class: row }) => ({
      id: row.id,
      name: row.name,
      teacherName: row.teacher.name,
      startsAt: iso(row.startsAt),
      endsAt: iso(row.endsAt),
      joinedAt: joinedAt.toISOString(),
      courses: publishedCourses(row).map((course) => {
        const standing = describeEnrollment(byCourse.get(course.id));
        return {
          ...course,
          state: standing.state,
          percentComplete: standing.percentComplete,
          dueDates: row.dueDates
            .filter((due) => due.module.courseId === course.id)
            .map((due) => ({ moduleId: due.module.id, title: due.module.title, dueAt: due.dueAt.toISOString(), done: moduleDone(due.module.id) })),
        };
      }),
    })),
  };
}
