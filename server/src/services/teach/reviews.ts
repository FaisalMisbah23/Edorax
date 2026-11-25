import type { AcceptAiDraftsResult, AiReviewDraftResult, ReviewDetailView, ReviewQueueView } from "../../shared/api/teach.js";
import { loadIntegritySummaries } from "../integrity/review.js";
import { TEACH_ERROR_CODES } from "../../shared/api/teach.js";
import { OpenQuestionConfigSchema, OpenQuestionPayloadSchema } from "../../shared/blocks/open-question/schema.js";
import { parseSafeSubmissionUrl } from "../../shared/lib/safe-submission-url.js";
import { prisma } from "../../db/prisma.js";
import { ConflictError, NotFoundError, UnprocessableError } from "../../utils/errors.js";
import type { SessionUser } from "../../types/auth.js";
import { notifyMenteeReviewFeedback } from "../notifications/events.js";
import { dispatchNotification } from "../notifications/service.js";
import { adjustEnrollmentPendingReviews, recomputeChapterProgress, resolvePendingBlockReview } from "../progress/compute.js";
import { awardXp } from "../gamification/xp.js";
import { xpKeys } from "../../shared/gamification/xp.js";
import type { SubmitReviewBody } from "../../validations/teach.js";
import { mentoredCoursesWhere, requireCourseById } from "./access.js";
import { generateReviewDraft } from "./ai/review-draft.js";
import { ensureAutoDraft, queueAutoDrafts, readStoredDraft } from "./ai/auto-draft.js";
import { aiReviewAutoDraftAvailable } from "../../config/env.js";
import { loadAiKeyForUse } from "../ai/credentials.js";
import { AiError, type AiProviderName } from "../ai/openrouter.js";
import { CapstoneCheckConfigSchema } from "../../shared/blocks/capstone-check/schema.js";
import { toMentorView } from "../capstone/service.js";

// Mentor review of human-graded submissions (docs/05-review-queue.mdx).
// Completion tracks submission and review tracks quality, so a needs-revision
// verdict never reverts chapter completion; the only progress write is a
// recompute that folds the awarded score into the rollups.

/** Open answers across the caller's courses. Resubmissions jump the queue, then oldest first. */
export async function loadReviewQueue(user: SessionUser, courseFilter?: string): Promise<ReviewQueueView> {
  const courses = await prisma.course.findMany({
    where: mentoredCoursesWhere(user, "SUBMISSION_EVALUATOR"),
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
  const courseIds = courses.map((course) => course.id);
  const scope = courseFilter && courseIds.includes(courseFilter) ? courseFilter : { in: courseIds };

  const pending =
    courseIds.length === 0
      ? []
      : await prisma.response.findMany({
          where: { status: "PENDING_REVIEW", block: { chapter: { courseId: scope } } },
          orderBy: { submittedAt: "asc" },
          include: {
            user: { select: { name: true, email: true } },
            block: {
              select: {
                type: true,
                points: true,
                chapter: { select: { id: true, title: true, module: { select: { title: true } }, course: { select: { slug: true, title: true } } } },
              },
            },
          },
        });
  const progress = await loadLearnerProgress(pending.map((response) => response.enrollmentId));

  pending.sort((a, b) => {
    const aResub = a.attempt > 1 ? 0 : 1;
    const bResub = b.attempt > 1 ? 0 : 1;
    if (aResub !== bResub) return aResub - bResub;
    return a.submittedAt.getTime() - b.submittedAt.getTime();
  });

  const items = pending.map((response) => ({
    id: response.id,
    attempt: response.attempt,
    submittedAt: response.submittedAt.toISOString(),
    learnerLabel: response.user.name ?? response.user.email,
    courseTitle: response.block.chapter.course.title,
    chapterTitle: response.block.chapter.title,
    blockType: response.block.type,
    maxScore: response.block.points,
    aiDraft: readStoredDraft(response.aiDraft, response.aiDraftModel)?.draft ?? null,
    aiDraftModel: response.aiDraft ? response.aiDraftModel : null,
    aiDraftCostUsd: response.aiDraft && response.aiDraftCostMicroUsd != null ? response.aiDraftCostMicroUsd / 1_000_000 : null,
    ...reviewContext(response.block.chapter, response.enrollmentId, progress),
  }));
  // Open answers without a draft yet get one in the background, oldest first.
  queueAutoDrafts(items.filter((item) => item.blockType === "OPEN_QUESTION" && !item.aiDraft).map((item) => item.id));

  const draftCostUsd = items.reduce((sum, item) => sum + (item.aiDraftCostUsd ?? 0), 0);
  return { courses, items, autoDraft: aiReviewAutoDraftAvailable, draftCostUsd };
}

type LearnerProgress = NonNullable<ReviewDetailView["learnerProgress"]>;

async function loadLearnerProgress(enrollmentIds: string[]): Promise<Map<string, LearnerProgress>> {
  const ids = [...new Set(enrollmentIds)];
  if (!ids.length) return new Map();
  const rows = await prisma.enrollment.findMany({
    where: { id: { in: ids } },
    select: { id: true, percentComplete: true, chaptersCompleted: true, status: true },
  });
  return new Map(rows.map((row) => [row.id, { percentComplete: row.percentComplete, chaptersCompleted: row.chaptersCompleted, status: row.status }]));
}

function reviewContext(
  chapter: { id: string; module: { title: string } | null; course: { slug: string } },
  enrollmentId: string,
  progress: Map<string, LearnerProgress>
) {
  const slug = chapter.course.slug;
  return {
    courseSlug: slug,
    moduleTitle: chapter.module?.title ?? null,
    chapterHref: `/courses/${encodeURIComponent(slug)}/preview?chapter=${encodeURIComponent(chapter.id)}`,
    learnerHref: `/courses/${encodeURIComponent(slug)}/mentees/${encodeURIComponent(enrollmentId)}`,
    learnerProgress: progress.get(enrollmentId) ?? null,
  };
}

async function requireReviewableResponse(user: SessionUser, responseId: string) {
  const response = await prisma.response.findUnique({
    where: { id: responseId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      block: {
        include: { chapter: { select: { id: true, title: true, module: { select: { title: true } }, course: { select: { id: true, slug: true, title: true } } } } },
      },
      review: { select: { score: true, verdict: true } },
    },
  });
  if (!response) throw new NotFoundError("Submission not found");
  await requireCourseById(user, response.block.chapter.course.id, "SUBMISSION_EVALUATOR");
  return response;
}

/** One submission with the mentor-only question config and the learner's previous exchanges. */
export async function loadReviewDetail(user: SessionUser, responseId: string): Promise<ReviewDetailView> {
  const response = await requireReviewableResponse(user, responseId);

  const [history, integrity, progress] = await Promise.all([
    prisma.response.findMany({
      where: { blockId: response.blockId, userId: response.userId, review: { isNot: null } },
      orderBy: { attempt: "asc" },
      select: { id: true, attempt: true, review: { select: { verdict: true, feedback: true, reviewer: { select: { name: true } } } } },
    }),
    loadIntegritySummaries(response.enrollmentId, response.block.chapter.id),
    loadLearnerProgress([response.enrollmentId]),
  ]);
  // The first pass is usually ready from the queue; if not, make it now (a few seconds on Haiku).
  const aiDraft =
    response.status === "PENDING_REVIEW" && response.block.type === "OPEN_QUESTION"
      ? (readStoredDraft(response.aiDraft, response.aiDraftModel, response.aiDraftCostMicroUsd) ?? (await ensureAutoDraft(response.id)))
      : null;

  const config = OpenQuestionConfigSchema.safeParse(response.block.config);
  const capstone = response.block.type === "CAPSTONE_CHECK" ? await loadCapstoneReview(response.blockId, response.userId, response.id, response.block.config) : null;
  const payload = response.payload as { text?: string; url?: string } | null;
  const rawUrl = typeof payload?.url === "string" ? payload.url : null;
  const answerText =
    typeof payload?.text === "string" && payload.text.trim()
      ? payload.text
      : rawUrl
        ? `(Link submission)\n${rawUrl}`
        : JSON.stringify(response.payload, null, 2);

  return {
    id: response.id,
    status: response.status,
    attempt: response.attempt,
    submittedAt: response.submittedAt.toISOString(),
    learner: response.user,
    course: response.block.chapter.course,
    chapterTitle: response.block.chapter.title,
    block: { id: response.block.id, type: response.block.type, points: response.block.points },
    question: config.success
      ? {
          prompt: config.data.prompt,
          minWords: config.data.minWords,
          maxWords: config.data.maxWords ?? null,
          rubric: config.data.rubric ?? null,
          sampleAnswer: config.data.sampleAnswer ?? null,
        }
      : null,
    answerText,
    answerUrl: rawUrl ? (parseSafeSubmissionUrl(rawUrl)?.toString() ?? null) : null,
    review: response.review,
    history: history.flatMap((item) =>
      item.review
        ? [{ id: item.id, attempt: item.attempt, verdict: item.review.verdict, feedback: item.review.feedback, reviewerName: item.review.reviewer.name }]
        : []
    ),
    integrity,
    capstone,
    aiDraft,
    platformDraft: aiReviewAutoDraftAvailable,
    ...reviewContext(response.block.chapter, response.enrollmentId, progress),
  };
}

/** The check this Response carries plus the learner's other checks, with cost and model for the mentor. */
async function loadCapstoneReview(blockId: string, userId: string, responseId: string, rawConfig: unknown): Promise<ReviewDetailView["capstone"]> {
  const config = CapstoneCheckConfigSchema.safeParse(rawConfig);
  const checks = await prisma.capstoneCheck.findMany({ where: { blockId, userId }, orderBy: { createdAt: "desc" }, take: 20 });
  const current = checks.find((check) => check.responseId === responseId) ?? null;
  return {
    title: config.success ? (config.data.title ?? config.data.rubric.title) : "Capstone",
    current: current ? toMentorView(current) : null,
    history: checks.filter((check) => check.id !== current?.id).map(toMentorView),
  };
}

export async function submitReview(user: SessionUser, responseId: string, input: SubmitReviewBody): Promise<void> {
  const response = await requireReviewableResponse(user, responseId);
  if (response.status !== "PENDING_REVIEW") {
    throw new ConflictError("This submission has already been reviewed.", TEACH_ERROR_CODES.ALREADY_REVIEWED);
  }

  const maxScore = response.block.points;
  const score = input.score !== undefined ? Math.min(input.score, maxScore) : null;

  await prisma.$transaction(async (tx) => {
    await tx.response.update({
      where: { id: response.id },
      data: { status: input.verdict === "APPROVED" ? "REVIEWED" : "NEEDS_REVISION", score, maxScore },
    });
    await tx.review.create({
      data: { responseId: response.id, reviewerId: user.id, feedback: input.feedback, verdict: input.verdict, score },
    });
    await resolvePendingBlockReview(tx, response.blockId);
    // An old answer can outlive its enrollment (the learner left or was removed). The review
    // is still recorded; there is just no enrollment left to update.
    const enrolled = await tx.enrollment.findUnique({ where: { id: response.enrollmentId }, select: { id: true } });
    if (!enrolled) return;
    await adjustEnrollmentPendingReviews(tx, response.enrollmentId, -1);
    await recomputeChapterProgress(tx, response.enrollmentId, response.block.chapter.id);
    if (input.verdict === "APPROVED") {
      // Once per question: a later approved resubmission of the same block earns nothing more.
      await awardXp(tx, {
        userId: response.userId,
        enrollmentId: response.enrollmentId,
        courseId: response.block.chapter.course.id,
        source: "answer_approved",
        sourceKey: xpKeys.answerApproved(response.blockId),
      });
    }
  });

  await dispatchNotification(() => notifyMenteeReviewFeedback({ responseId: response.id, verdict: input.verdict, feedbackPreview: input.feedback }));
}

/** Advisory AI draft for an open-question answer; the mentor edits and submits it. */
export async function generateAiReviewDraft(user: SessionUser, responseId: string): Promise<AiReviewDraftResult> {
  const response = await requireReviewableResponse(user, responseId);
  if (response.status !== "PENDING_REVIEW") {
    throw new ConflictError("This submission has already been reviewed.", TEACH_ERROR_CODES.ALREADY_REVIEWED);
  }
  if (response.block.type !== "OPEN_QUESTION") {
    throw new UnprocessableError("AI drafting currently supports open-question responses.", TEACH_ERROR_CODES.AI_DRAFT_UNSUPPORTED);
  }

  const config = OpenQuestionConfigSchema.safeParse(response.block.config);
  const payload = OpenQuestionPayloadSchema.safeParse(response.payload);
  if (!config.success || !payload.success) {
    throw new UnprocessableError("This submission could not be prepared for AI review.", TEACH_ERROR_CODES.AI_DRAFT_UNSUPPORTED);
  }

  // With automatic drafts on, "Draft again" runs on the platform key: the mentor needs no key.
  if (aiReviewAutoDraftAvailable) {
    const fresh = await ensureAutoDraft(response.id, { force: true });
    if (fresh) return fresh;
    throw new UnprocessableError("AI drafting is temporarily unavailable. Try again in a moment.", TEACH_ERROR_CODES.AI_DRAFT_UNAVAILABLE);
  }

  // The reviewing instructor's own OpenRouter or Anthropic key pays for the draft.
  let instructorKey: { provider: AiProviderName; apiKey: string; model: string };
  try {
    instructorKey = await loadAiKeyForUse(user.id);
  } catch (error) {
    if (error instanceof AiError && error.code === "AI_KEY_REQUIRED") {
      throw new UnprocessableError("Add your OpenRouter or Anthropic (Claude) key in Settings to use AI drafting.", TEACH_ERROR_CODES.AI_DRAFT_UNAVAILABLE);
    }
    if (error instanceof AiError && error.code === "AI_KEY_INVALID") {
      throw new UnprocessableError(error.message, TEACH_ERROR_CODES.AI_DRAFT_UNAVAILABLE);
    }
    throw new UnprocessableError("AI drafting is temporarily unavailable. Try again in a moment.", TEACH_ERROR_CODES.AI_DRAFT_UNAVAILABLE);
  }
  if (instructorKey.provider === "GEMINI") {
    throw new UnprocessableError("AI drafting needs an OpenRouter or Anthropic (Claude) key. Switch your key in Settings.", TEACH_ERROR_CODES.AI_DRAFT_UNSUPPORTED);
  }

  const priorResponses = await prisma.response.findMany({
    where: { blockId: response.blockId, userId: response.userId, id: { not: response.id }, review: { isNot: null } },
    orderBy: { attempt: "desc" },
    take: 3,
    select: { review: { select: { feedback: true } } },
  });

  const answerParts = [payload.data.text.trim()];
  if (payload.data.url?.trim()) answerParts.push(`Submitted URL (not fetched): ${payload.data.url.trim()}`);

  try {
    const result = await generateReviewDraft({
      courseTitle: response.block.chapter.course.title,
      chapterTitle: response.block.chapter.title,
      prompt: config.data.prompt,
      rubric: config.data.rubric,
      sampleAnswer: config.data.sampleAnswer,
      answer: answerParts.filter(Boolean).join("\n\n"),
      previousFeedback: priorResponses.flatMap((item) => (item.review?.feedback ? [item.review.feedback] : [])),
      maxScore: response.block.points,
    }, { provider: instructorKey.provider, apiKey: instructorKey.apiKey, model: instructorKey.model });
    return {
      model: result.model,
      draft: { ...result.draft, suggestedScore: Math.min(result.draft.suggestedScore, response.block.points) },
    };
  } catch (error) {
    // Configuration and upstream failures are safe to show; anything else stays generic.
    const message = error instanceof Error ? error.message : "";
    const safeMessage =
      message.includes("Add your AI key") ||
      message.startsWith("OpenRouter could not generate") ||
      message.startsWith("OpenRouter returned an unreadable") ||
      message.startsWith("Claude could not generate") ||
      message.startsWith("Claude returned an unreadable")
        ? message
        : "AI drafting is temporarily unavailable. Try again in a moment.";
    throw new UnprocessableError(safeMessage, TEACH_ERROR_CODES.AI_DRAFT_UNAVAILABLE);
  }
}

/** Send the saved AI draft as the review, unchanged: the mentor's one-tap approval of the first pass. */
export async function acceptAiDraft(user: SessionUser, responseId: string): Promise<void> {
  const response = await requireReviewableResponse(user, responseId);
  const stored = readStoredDraft(response.aiDraft, response.aiDraftModel);
  if (!stored) {
    throw new UnprocessableError("There is no AI draft for this answer yet. Open it to review by hand.", TEACH_ERROR_CODES.AI_DRAFT_UNAVAILABLE);
  }
  await submitReview(user, responseId, {
    verdict: stored.draft.suggestedVerdict,
    feedback: stored.draft.feedback,
    score: Math.min(stored.draft.suggestedScore, response.block.points),
  });
}

/** Send many saved AI drafts in one go. Each is checked and sent on its own; one failure does not stop the rest. */
export async function acceptAiDrafts(user: SessionUser, responseIds: string[]): Promise<AcceptAiDraftsResult> {
  let sent = 0;
  let failed = 0;
  for (const responseId of [...new Set(responseIds)]) {
    try {
      await acceptAiDraft(user, responseId);
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}
