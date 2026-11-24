import type { EarlierAnswer, EarlierAnswersChapter, EarlierAnswersResponse } from "../../shared/api/chapters.js";
import { parseLearningLog } from "../../shared/lib/learning-log.js";
import { applyTokens, contentTokenValues } from "../../shared/lib/content-tokens.js";
import { resolveCourseFamily } from "../../shared/lib/course-tracks.js";
import { prisma } from "../../db/prisma.js";
import { NotFoundError } from "../../utils/errors.js";
import type { SessionUser } from "../../types/auth.js";
import { requireBlockSubmissionAccess } from "../enrollment/api-learn-access.js";
import { extractLearningLogQuestions } from "./reflection.js";

// What the learner already wrote in earlier chapters of the same course: learning-log
// answers (ChapterProgress.learningLog) and submitted open-question responses. The
// reader shows it as a recall panel and the personalizer feeds it to the model.

const MAX_CHAPTERS = 80;
const MAX_ANSWER_CHARS = 2000;

type CollectInput = {
  courseId: string;
  userId: string;
  enrollmentId: string;
  variantSlug: string | null;
  /** Only chapters that come before this order in the course. */
  beforeOrder: number;
  /** Limit to these chapter slugs (the author's `personalizeFrom`); empty means every earlier chapter. */
  chapterSlugs?: string[];
};

export async function collectEarlierAnswers(input: CollectInput): Promise<EarlierAnswersChapter[]> {
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { familySlug: true, variantFamily: true },
  });
  const tokens = contentTokenValues(resolveCourseFamily(course?.familySlug ?? null, course?.variantFamily ?? null), input.variantSlug);

  const chapters = await prisma.chapter.findMany({
    where: {
      courseId: input.courseId,
      archivedAt: null,
      order: { lt: input.beforeOrder },
      ...(input.chapterSlugs && input.chapterSlugs.length > 0 ? { slug: { in: input.chapterSlugs } } : {}),
    },
    orderBy: { order: "asc" },
    take: MAX_CHAPTERS,
    select: { id: true, slug: true, title: true, source: true },
  });
  if (chapters.length === 0) return [];
  const chapterIds = chapters.map((chapter) => chapter.id);

  const [progressRows, responses] = await Promise.all([
    prisma.chapterProgress.findMany({
      where: { enrollmentId: input.enrollmentId, chapterId: { in: chapterIds }, learningLog: { not: null as never } },
      select: { chapterId: true, learningLog: true },
    }),
    prisma.response.findMany({
      where: {
        userId: input.userId,
        status: { not: "DRAFT" },
        block: { chapterId: { in: chapterIds }, type: "OPEN_QUESTION", archivedAt: null },
      },
      orderBy: [{ blockId: "asc" }, { attempt: "desc" }],
      distinct: ["blockId"],
      select: { blockId: true, payload: true, submittedAt: true, block: { select: { chapterId: true, order: true, config: true } } },
    }),
  ]);

  const logByChapter = new Map(progressRows.map((row) => [row.chapterId, parseLearningLog(row.learningLog)]));
  const openByChapter = new Map<string, typeof responses>();
  for (const response of responses) {
    const list = openByChapter.get(response.block.chapterId) ?? [];
    list.push(response);
    openByChapter.set(response.block.chapterId, list);
  }

  const result: EarlierAnswersChapter[] = [];
  for (const chapter of chapters) {
    const answers: EarlierAnswer[] = [];

    const log = logByChapter.get(chapter.id);
    if (log) {
      for (const question of extractLearningLogQuestions(chapter.source)) {
        const saved = log.answers[question.id];
        const text = saved?.text.trim();
        if (!saved || !text) continue;
        answers.push({
          id: question.id,
          kind: "learning_log",
          question: applyTokens(question.title, tokens),
          answer: text.slice(0, MAX_ANSWER_CHARS),
          answeredAt: saved.updatedAt,
        });
      }
    }

    const open = (openByChapter.get(chapter.id) ?? []).sort((a, b) => a.block.order - b.block.order);
    for (const response of open) {
      const payload = (response.payload ?? {}) as { text?: unknown };
      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      const prompt = (response.block.config as { prompt?: unknown } | null)?.prompt;
      if (!text || typeof prompt !== "string" || !prompt.trim()) continue;
      answers.push({
        id: response.blockId,
        kind: "open_question",
        question: applyTokens(prompt.trim(), tokens),
        answer: text.slice(0, MAX_ANSWER_CHARS),
        answeredAt: response.submittedAt.toISOString(),
      });
    }

    if (answers.length > 0) {
      result.push({ chapterId: chapter.id, chapterSlug: chapter.slug, chapterTitle: chapter.title, answers });
    }
  }
  return result;
}

/** GET /api/v1/chapters/:chapterId/earlier-answers */
export async function listEarlierAnswers(user: SessionUser, chapterId: string): Promise<EarlierAnswersResponse> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId, archivedAt: null },
    select: { courseId: true, order: true },
  });
  if (!chapter) throw new NotFoundError("Chapter not found.");
  const enrollment = await requireBlockSubmissionAccess(chapter.courseId, user);
  const chapters = await collectEarlierAnswers({
    courseId: chapter.courseId,
    userId: user.id,
    enrollmentId: enrollment.id,
    variantSlug: enrollment.variantSlug ?? null,
    beforeOrder: chapter.order,
  });
  return { chapters };
}
