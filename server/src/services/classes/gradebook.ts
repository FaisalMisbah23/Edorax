import type { ClassGradebookView, GradebookCell, GradebookColumn, GradebookRow } from "../../shared/api/classes.js";
import { prisma } from "../../db/prisma.js";
import { resolveCourseFamily } from "../../shared/lib/course-tracks.js";
import type { SessionUser } from "../../types/auth.js";
import { toCsv, type CsvValue } from "../../utils/csv.js";
import { readReleaseContent, variantForRelease, type ReleaseContent } from "../courses/releases.js";
import { CONFIRMED_ENROLLMENT_WHERE } from "../enrollment/lifecycle.js";
import { requireOwnClass } from "./classes.js";

// The gradebook for one class: a row per learner, and for each course a column per
// module, one per project check, and one for the course as a whole. It only reads
// what the reader already records (ChapterProgress, Enrollment rollups and
// CapstoneCheck), so a mark here always matches what the learner sees.

type ModuleShape = { id: string; title: string; chapterIds: string[] };

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
const EMPTY: GradebookCell = { mark: null, progress: null, score: 0, maxScore: 0, status: "none", late: false };

export async function loadClassGradebook(user: SessionUser, classId: string, now = new Date()): Promise<ClassGradebookView> {
  const owned = await requireOwnClass(user, classId);

  const [classCourses, members, dueDates] = await Promise.all([
    prisma.teachingClassCourse.findMany({
      where: { classId },
      orderBy: { order: "asc" },
      select: {
        course: {
          select: {
            id: true, title: true, familySlug: true, variantFamily: true, activeReleaseId: true,
            modules: {
              where: { archivedAt: null },
              orderBy: { order: "asc" },
              select: { id: true, title: true, chapters: { where: { archivedAt: null, publishedAt: { not: null } }, orderBy: { order: "asc" }, select: { id: true } } },
            },
          },
        },
      },
    }),
    prisma.teachingClassMember.findMany({
      where: { classId },
      orderBy: { joinedAt: "asc" },
      select: { userId: true, user: { select: { name: true, email: true } } },
    }),
    prisma.teachingClassDueDate.findMany({ where: { classId }, select: { moduleId: true, dueAt: true } }),
  ]);

  const courses = classCourses.map((item) => item.course);
  const courseIds = courses.map((course) => course.id);
  const memberIds = members.map((member) => member.userId);
  const dueByModule = new Map(dueDates.map((item) => [item.moduleId, item.dueAt]));

  const [enrollments, projectBlocks] = await Promise.all([
    memberIds.length
      ? prisma.enrollment.findMany({
          where: { courseId: { in: courseIds }, userId: { in: memberIds }, ...CONFIRMED_ENROLLMENT_WHERE },
          select: {
            id: true, userId: true, courseId: true, status: true, percentComplete: true, totalScore: true, maxScore: true,
            releaseId: true, variantSlug: true,
            chapterProgress: { select: { chapterId: true, status: true, score: true, maxScore: true, completedAt: true } },
          },
        })
      : [],
    prisma.block.findMany({
      where: { type: "CAPSTONE_CHECK", archivedAt: null, chapter: { courseId: { in: courseIds }, archivedAt: null } },
      orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
      select: { id: true, chapter: { select: { courseId: true, title: true } } },
    }),
  ]);

  const projectChecks = projectBlocks.length && memberIds.length
    ? await prisma.capstoneCheck.findMany({
        where: { blockId: { in: projectBlocks.map((block) => block.id) }, userId: { in: memberIds } },
        select: { blockId: true, userId: true, status: true, percent: true, completed: true },
      })
    : [];

  // A learner's modules come from the release and variant they are on, so a learner on
  // an older release or another variant is marked against the lessons they were given.
  const releaseIds = [...new Set([...courses.map((course) => course.activeReleaseId), ...enrollments.map((item) => item.releaseId)].filter((id): id is string => Boolean(id)))];
  const releases = releaseIds.length ? await prisma.courseRelease.findMany({ where: { id: { in: releaseIds } }, select: { id: true, content: true } }) : [];
  const releaseContent = new Map<string, ReleaseContent>(releases.map((release) => [release.id, readReleaseContent(release.content)]));

  const columns: GradebookColumn[] = [];
  const modulesFor = new Map<string, (releaseId: string | null, variantSlug: string | null) => ModuleShape[]>();

  for (const course of courses) {
    const family = resolveCourseFamily(course.familySlug, course.variantFamily);
    const live: ModuleShape[] = course.modules.map((module) => ({ id: module.id, title: module.title, chapterIds: module.chapters.map((chapter) => chapter.id) }));
    const shapes = (releaseId: string | null, variantSlug: string | null): ModuleShape[] => {
      const content = releaseContent.get(releaseId ?? course.activeReleaseId ?? "");
      const modules = content?.variants?.[variantForRelease(family, variantSlug)] ?? content?.variants?.default;
      return modules ? modules.map((module) => ({ id: module.id, title: module.title, chapterIds: module.chapters.map((chapter) => chapter.id) })) : live;
    };
    modulesFor.set(course.id, shapes);

    // Columns follow the current release in its default variant, the same view the course report uses.
    for (const module of shapes(null, null)) {
      columns.push({ key: `m:${module.id}`, kind: "module", courseId: course.id, courseTitle: course.title, label: module.title, dueAt: dueByModule.get(module.id)?.toISOString() ?? null });
    }
    const projects = projectBlocks.filter((block) => block.chapter.courseId === course.id);
    for (const block of projects) {
      columns.push({ key: `p:${block.id}`, kind: "project", courseId: course.id, courseTitle: course.title, label: projects.length > 1 ? `Project: ${block.chapter.title}` : "Project", dueAt: null });
    }
    columns.push({ key: `c:${course.id}`, kind: "course", courseId: course.id, courseTitle: course.title, label: "Course total", dueAt: null });
  }

  const enrollmentFor = new Map(enrollments.map((item) => [`${item.userId}:${item.courseId}`, item]));
  const checksFor = new Map<string, typeof projectChecks>();
  for (const check of projectChecks) {
    const key = `${check.userId}:${check.blockId}`;
    checksFor.set(key, [...(checksFor.get(key) ?? []), check]);
  }

  const rows: GradebookRow[] = members.map((member) => {
    const cells: Record<string, GradebookCell> = {};

    for (const course of courses) {
      const enrollment = enrollmentFor.get(`${member.userId}:${course.id}`);
      if (!enrollment) continue; // not enrolled: the course's cells stay absent

      const progressByChapter = new Map(enrollment.chapterProgress.map((item) => [item.chapterId, item]));
      for (const module of modulesFor.get(course.id)!(enrollment.releaseId, enrollment.variantSlug)) {
        const dueAt = dueByModule.get(module.id) ?? null;
        const progress = module.chapterIds.flatMap((id) => progressByChapter.get(id) ?? []);
        const done = progress.filter((item) => item.status === "COMPLETED");
        const score = progress.reduce((sum, item) => sum + item.score, 0);
        const maxScore = progress.reduce((sum, item) => sum + item.maxScore, 0);
        const finished = module.chapterIds.length > 0 && done.length === module.chapterIds.length;
        const started = progress.some((item) => item.status !== "NOT_STARTED");
        const finishedAt = finished ? Math.max(...done.map((item) => item.completedAt?.getTime() ?? 0)) : null;
        cells[`m:${module.id}`] = {
          mark: percent(score, maxScore),
          progress: percent(done.length, module.chapterIds.length),
          score,
          maxScore,
          status: finished ? "done" : started ? "in-progress" : "none",
          late: dueAt !== null && (finishedAt === null ? now > dueAt : finishedAt > dueAt.getTime()),
        };
      }

      for (const block of projectBlocks) {
        if (block.chapter.courseId !== course.id) continue;
        const checks = checksFor.get(`${member.userId}:${block.id}`) ?? [];
        const graded = checks.filter((check) => check.status === "DONE" && check.percent !== null);
        const best = graded.length ? Math.max(...graded.map((check) => check.percent!)) : null;
        const passed = checks.some((check) => check.completed === true);
        cells[`p:${block.id}`] = {
          mark: best,
          progress: null,
          score: best ?? 0,
          maxScore: best === null ? 0 : 100,
          status: passed ? "done" : checks.length ? "in-progress" : "none",
          late: false,
        };
      }

      cells[`c:${course.id}`] = {
        mark: percent(enrollment.totalScore, enrollment.maxScore),
        progress: enrollment.percentComplete,
        score: enrollment.totalScore,
        maxScore: enrollment.maxScore,
        status: enrollment.status === "COMPLETED" ? "done" : enrollment.chapterProgress.some((item) => item.status !== "NOT_STARTED") ? "in-progress" : "none",
        late: false,
      };
    }

    return {
      userId: member.userId,
      name: member.user.name ?? member.user.email ?? "Unnamed learner",
      email: member.user.email,
      cells,
      lateCount: Object.values(cells).filter((cell) => cell.late).length,
    };
  });

  return { class: { id: owned.id, name: owned.name }, columns, rows, generatedAt: now.toISOString() };
}

const fileSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "class";

/**
 * The gradebook as a spreadsheet. Each item gets a mark column (blank when nothing
 * is graded yet) and, where it applies, a progress column, so a teacher can paste
 * the marks straight into their own results sheet.
 */
export async function exportClassGradebookCsv(user: SessionUser, classId: string): Promise<{ filename: string; csv: string }> {
  const view = await loadClassGradebook(user, classId);
  const manyCourses = new Set(view.columns.map((column) => column.courseId)).size > 1;
  const title = (column: GradebookColumn) => (manyCourses ? `${column.courseTitle}: ${column.label}` : column.label);

  const header: string[] = ["name", "email"];
  for (const column of view.columns) {
    header.push(`${title(column)} (mark %)`);
    if (column.kind !== "project") header.push(`${title(column)} (done %)`);
    if (column.dueAt) header.push(`${title(column)} (late)`);
  }
  header.push("late items");

  const rows = view.rows.map((row) => {
    const line: CsvValue[] = [row.name, row.email ?? ""];
    for (const column of view.columns) {
      const cell = row.cells[column.key] ?? EMPTY;
      line.push(cell.mark ?? "");
      if (column.kind !== "project") line.push(cell.progress ?? "");
      if (column.dueAt) line.push(cell.late ? "late" : "");
    }
    line.push(row.lateCount);
    return line;
  });

  return { filename: `${fileSlug(view.class.name)}-gradebook.csv`, csv: toCsv([header, ...rows]) };
}
