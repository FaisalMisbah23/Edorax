import type { FeedbackItem, FeedbackView, ThreadFeedbackView } from "../../shared/api/teach.js";
import { prisma } from "../../db/prisma.js";
import { NotFoundError } from "../../utils/errors.js";
import type { SessionUser } from "../../types/auth.js";
import { mentoredCoursesWhere, requireCourseById } from "./access.js";

// Feedback for the team: things learners raised that point at a problem with a course
// or with the platform. Two sources feed it: lesson reports learners file themselves,
// and question threads a mentor flags.

const FEEDBACK_LIMIT = 300;

async function requireMentoredThread(user: SessionUser, threadId: string) {
  const thread = await prisma.helpThread.findUnique({
    where: { id: threadId },
    select: { id: true, courseId: true, feedbackScope: true, feedbackNote: true },
  });
  if (!thread) throw new NotFoundError("Question not found");
  await requireCourseById(user, thread.courseId, "SUBMISSION_EVALUATOR");
  return thread;
}

export async function loadThreadFeedback(user: SessionUser, threadId: string): Promise<ThreadFeedbackView> {
  const thread = await requireMentoredThread(user, threadId);
  return { scope: thread.feedbackScope, note: thread.feedbackNote };
}

/** Flag a thread as course or platform feedback, or clear the flag with a null scope. */
export async function setThreadFeedback(
  user: SessionUser,
  threadId: string,
  input: { scope: "COURSE" | "PLATFORM" | null; note?: string | null }
): Promise<ThreadFeedbackView> {
  await requireMentoredThread(user, threadId);
  const note = input.scope ? (input.note?.trim() || null) : null;
  const row = await prisma.helpThread.update({
    where: { id: threadId },
    data: { feedbackScope: input.scope, feedbackNote: note, feedbackAt: input.scope ? new Date() : null },
    select: { feedbackScope: true, feedbackNote: true },
  });
  return { scope: row.feedbackScope, note: row.feedbackNote };
}

export async function loadFeedback(user: SessionUser): Promise<FeedbackView> {
  const threads = await prisma.helpThread.findMany({
    where: { course: mentoredCoursesWhere(user), OR: [{ feedbackScope: { not: null } }, { kind: "LESSON_REPORT" }] },
    orderBy: { createdAt: "desc" },
    take: FEEDBACK_LIMIT,
    select: {
      id: true,
      status: true,
      kind: true,
      category: true,
      quote: true,
      feedbackScope: true,
      feedbackNote: true,
      createdAt: true,
      mentee: { select: { name: true, email: true } },
      course: { select: { title: true } },
      chapter: { select: { title: true, module: { select: { title: true } } } },
      messages: { orderBy: { createdAt: "asc" }, take: 1, select: { body: true } },
    },
  });

  const items: FeedbackItem[] = threads.map((thread) => ({
    id: thread.id,
    // A lesson report is about the course unless a mentor says it is the platform.
    scope: thread.feedbackScope ?? "COURSE",
    source: thread.kind === "LESSON_REPORT" ? "report" : "flag",
    category: thread.category,
    status: thread.status,
    courseTitle: thread.course.title,
    moduleTitle: thread.chapter?.module?.title ?? null,
    chapterTitle: thread.chapter?.title ?? null,
    learnerLabel: thread.mentee.name ?? thread.mentee.email,
    note: thread.feedbackNote,
    quote: thread.quote,
    message: thread.messages[0]?.body ?? null,
    createdAt: thread.createdAt.toISOString(),
    href: `/help/${thread.id}`,
  }));

  return {
    items,
    counts: {
      course: items.filter((item) => item.scope === "COURSE").length,
      platform: items.filter((item) => item.scope === "PLATFORM").length,
      open: items.filter((item) => item.status === "OPEN").length,
    },
  };
}
