import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../../src/db/prisma.js";
import type { Block } from "../../src/generated/prisma/index.js";
import { createSession } from "../../src/services/auth/session.js";
import { hashIntegrationSecret } from "../../src/services/integrations/credential-hash.js";

// Each test file builds its own small course so suites never share rows and can
// run against a developer database without touching seeded data. Everything is
// tagged with a random suffix and removed by `cleanup()`.

export const QUIZ_CONFIG = {
  quizType: "single",
  prompt: "2 + 2?",
  options: [
    { id: "a", label: "4" },
    { id: "b", label: "5" },
  ],
  correctOptionIds: ["a"],
  explanation: "Basic arithmetic.",
  allowRetry: true,
};

const MUST_READ_CONFIG = {
  title: "Read me",
  description: "Background reading.",
  url: "https://example.com/reading",
  required: true,
  completionRule: "confirm_read",
};

export async function createCourseFixture() {
  const tag = randomUUID().slice(0, 8);

  const mentor = await prisma.user.create({
    data: { email: `mentor-${tag}@test.local`, name: "Test Mentor", role: "MENTOR", emailVerified: new Date() },
  });
  const learner = await prisma.user.create({
    data: { email: `learner-${tag}@test.local`, name: "Test Learner", role: "MENTEE", emailVerified: new Date() },
  });
  const unverified = await prisma.user.create({
    data: { email: `unverified-${tag}@test.local`, name: "Unverified", role: "MENTEE" },
  });

  const course = await prisma.course.create({
    data: { slug: `test-course-${tag}`, title: `Test course ${tag}`, status: "PUBLISHED", sequential: true, mentorId: mentor.id, publishedAt: new Date() },
  });
  const module = await prisma.module.create({ data: { courseId: course.id, title: "Module 1", order: 1 } });

  const chapterA = await prisma.chapter.create({
    data: { courseId: course.id, moduleId: module.id, slug: "chapter-a", title: "Chapter A", order: 1, source: "# A", publishedAt: new Date() },
  });
  const chapterB = await prisma.chapter.create({
    data: { courseId: course.id, moduleId: module.id, slug: "chapter-b", title: "Chapter B", order: 2, source: "# B", readerMode: "QUIZ", publishedAt: new Date() },
  });

  const quizBlock = await prisma.block.create({
    data: { id: `blk-quiz-${tag}`, chapterId: chapterA.id, type: "QUIZ", order: 1, config: QUIZ_CONFIG },
  });
  const mustReadBlock = await prisma.block.create({
    data: { id: `blk-read-${tag}`, chapterId: chapterA.id, type: "MUST_READ", order: 2, config: MUST_READ_CONFIG },
  });
  const quizChapterBlocks: Block[] = [];
  for (const n of [1, 2]) {
    quizChapterBlocks.push(
      await prisma.block.create({
        data: { id: `blk-b${n}-${tag}`, chapterId: chapterB.id, type: "QUIZ", order: n, config: QUIZ_CONFIG },
      })
    );
  }

  const enrollment = await prisma.enrollment.create({
    data: { courseId: course.id, userId: learner.id, lifecycle: "ACTIVE", status: "IN_PROGRESS", source: "DIRECT", startedAt: new Date() },
  });

  const learnerSession = await createSession(learner.id, randomBytes(32).toString("hex"));
  const unverifiedSession = await createSession(unverified.id, randomBytes(32).toString("hex"));

  const userIds = [mentor.id, learner.id, unverified.id];

  async function cleanup() {
    const blockIds = [quizBlock.id, mustReadBlock.id, ...quizChapterBlocks.map((b) => b.id)];
    await prisma.response.deleteMany({ where: { blockId: { in: blockIds } } });
    await prisma.blockStats.deleteMany({ where: { blockId: { in: blockIds } } });
    await prisma.chapterProgress.deleteMany({ where: { enrollment: { courseId: course.id } } });
    await prisma.dailyActivity.deleteMany({ where: { enrollment: { courseId: course.id } } });
    await prisma.studySession.deleteMany({ where: { enrollment: { courseId: course.id } } });
    await prisma.enrollment.deleteMany({ where: { courseId: course.id } });
    await prisma.block.deleteMany({ where: { id: { in: blockIds } } });
    await prisma.chapter.deleteMany({ where: { courseId: course.id } });
    await prisma.module.deleteMany({ where: { courseId: course.id } });
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  return {
    tag,
    mentor,
    learner,
    unverified,
    course,
    chapterA,
    chapterB,
    quizBlock,
    mustReadBlock,
    quizChapterBlocks,
    enrollment,
    learnerToken: learnerSession.sessionToken,
    unverifiedToken: unverifiedSession.sessionToken,
    cleanup,
  };
}

/** Mark a chapter complete for an enrollment so the next chapter unlocks. */
export async function completeChapter(enrollmentId: string, chapterId: string) {
  await prisma.chapterProgress.upsert({
    where: { enrollmentId_chapterId: { enrollmentId, chapterId } },
    create: { enrollmentId, chapterId, status: "COMPLETED", startedAt: new Date(), completedAt: new Date() },
    update: { status: "COMPLETED", completedAt: new Date() },
  });
}

export async function createOrganizationFixture(courseId: string, options: { maxEnrollments?: number } = {}) {
  const tag = randomUUID().slice(0, 8);
  const secretKey = `sk_test_${tag}`;

  const organization = await prisma.organization.create({ data: { slug: `org-${tag}`, name: `Org ${tag}` } });
  const credential = await prisma.organizationApiCredential.create({
    data: { organizationId: organization.id, accessKey: `ak_test_${tag}`, secretHash: hashIntegrationSecret(secretKey) },
  });
  await prisma.organizationCourse.create({
    data: { organizationId: organization.id, courseId, maxEnrollments: options.maxEnrollments ?? 5 },
  });

  const headers = { "x-buildment-access-key": credential.accessKey, "x-buildment-secret-key": secretKey };

  async function cleanup() {
    const enrollments = await prisma.enrollment.findMany({
      where: { organizationId: organization.id },
      select: { id: true, learnerProfileId: true, learnerProfile: { select: { email: true } } },
    });
    const enrollmentIds = enrollments.map((e) => e.id);
    await prisma.payment.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
    await prisma.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } });
    // Learners without an account get email-only notifications, which no user cascade removes.
    const profileEmails = enrollments.flatMap((e) => (e.learnerProfile ? [e.learnerProfile.email] : []));
    await prisma.emailOutbox.deleteMany({ where: { userId: null, toEmail: { in: profileEmails } } });
    const profileIds = enrollments.map((e) => e.learnerProfileId).filter((id): id is string => Boolean(id));
    await prisma.learnerProfile.deleteMany({ where: { id: { in: profileIds } } });
    await prisma.organizationCourseRequest.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organizationCourse.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organizationApiCredential.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  }

  return { organization, headers, cleanup };
}

/**
 * A course whose second module has an alternative version `v2`. Module 1 is the base fixture's
 * (chapter-a, chapter-b). Module 2 (key `m2`) reads basics-one and basics-two by default, or
 * basics-v2-one in `v2`, which also holds a capstone block. Not sequential, so no chapter is locked.
 */
export async function createModuleVersionsFixture() {
  const fx = await createCourseFixture();
  await prisma.course.update({ where: { id: fx.course.id }, data: { sequential: false } });
  const module2 = await prisma.module.create({ data: { courseId: fx.course.id, title: "Module 2", order: 2, contentKey: "m2" } });
  const chapter = (slug: string, title: string, order: number, estimatedMinutes: number) =>
    prisma.chapter.create({ data: { courseId: fx.course.id, moduleId: module2.id, slug, title, order, estimatedMinutes, source: `# ${title}`, publishedAt: new Date() } });
  const basicsOne = await chapter("basics-one", "Basics one", 1, 10);
  const basicsTwo = await chapter("basics-two", "Basics two", 2, 5);
  const basicsV2One = await chapter("basics-v2-one", "Basics, rewritten", 3, 8);
  const capstoneBlock = await prisma.block.create({
    data: { id: `blk-cap-${fx.tag}`, chapterId: basicsV2One.id, type: "CAPSTONE_CHECK", order: 1, config: { title: "Capstone" } },
  });

  const releaseChapter = (row: { id: string; slug: string; title: string; order: number; estimatedMinutes: number | null; readerMode: "DEFAULT" | "QUIZ"; isMilestone: boolean; quizPassingScore: number; contentKey: string | null }) => ({
    id: row.id, key: row.contentKey, slug: row.slug, title: row.title, order: row.order, estimatedMinutes: row.estimatedMinutes,
    readerMode: row.readerMode, isMilestone: row.isMilestone, quizPassingScore: row.quizPassingScore,
  });
  const module1 = await prisma.module.findUniqueOrThrow({ where: { id: fx.chapterA.moduleId! } });
  const modules = [
    { id: module1.id, key: module1.contentKey, title: module1.title, order: 1, chapters: [releaseChapter(fx.chapterA), releaseChapter(fx.chapterB)] },
    {
      id: module2.id, key: "m2", title: module2.title, order: 2, defaultVersionLabel: "Original lessons",
      chapters: [releaseChapter(basicsOne), releaseChapter(basicsTwo)],
      versions: [{ key: "v2", label: "Rewritten: shorter and plainer", chapters: [releaseChapter(basicsV2One)] }],
    },
  ];
  const content = { variants: { default: modules } };
  const release = await prisma.courseRelease.create({ data: { courseId: fx.course.id, number: 1, content } });
  await prisma.course.update({ where: { id: fx.course.id }, data: { activeReleaseId: release.id } });
  await prisma.enrollment.update({ where: { id: fx.enrollment.id }, data: { releaseId: release.id } });

  async function cleanup() {
    await prisma.capstoneCheck.deleteMany({ where: { blockId: capstoneBlock.id } });
    await prisma.block.deleteMany({ where: { id: capstoneBlock.id } });
    await fx.cleanup();
  }

  return { ...fx, module1, module2, basicsOne, basicsTwo, basicsV2One, capstoneBlock, release, content, cleanup };
}
