import type { Prisma } from "../../../generated/prisma/index.js";
import type { AiReviewDraft } from "../../../shared/api/teach.js";
import { OpenQuestionConfigSchema, OpenQuestionPayloadSchema } from "../../../shared/blocks/open-question/schema.js";
import { aiReviewAutoDraftAvailable, env } from "../../../config/env.js";
import { prisma } from "../../../db/prisma.js";
import { logger } from "../../../utils/logger.js";
import { startOfUtcDay } from "../../ai/chapter-qa/usage.js";
import { costMicroUsd } from "../../capstone/grade.js";
import { AI_GRADING_COURSE_SELECT, effectiveAiGrading } from "../ai-grading.js";
import { AiReviewDraftSchema, generateReviewDraft, type ReviewDraftContext } from "./review-draft.js";

// Automatic first-pass reviews. Every pending open answer gets one AI draft on the
// platform's Anthropic key (Claude Haiku by default), saved on the Response. The mentor
// sees it prefilled and approves, edits or rejects it: nothing reaches the learner
// until a mentor sends it. A daily platform cap bounds the bill.
// Whether a course gets drafts, and on which model, comes from the AI grading settings:
// the course's own choice, else its owner's default, else the environment default.

export type StoredAiDraft = { draft: AiReviewDraft; model: string; costUsd: number | null };

const inFlight = new Set<string>();
const BACKGROUND_BATCH = 10;

/** Read a saved draft; null when missing or no longer valid. */
export function readStoredDraft(
  raw: Prisma.JsonValue | null | undefined,
  model: string | null | undefined,
  costMicro?: number | null
): StoredAiDraft | null {
  if (!raw || !model) return null;
  const parsed = AiReviewDraftSchema.safeParse(raw);
  return parsed.success ? { draft: parsed.data, model, costUsd: costMicro == null ? null : costMicro / 1_000_000 } : null;
}

/** The prompt context for one open answer, or null when the block or payload is not an open question. */
export async function loadReviewDraftContext(responseId: string): Promise<ReviewDraftContext | null> {
  const response = await prisma.response.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      blockId: true,
      userId: true,
      payload: true,
      block: { select: { type: true, points: true, config: true, chapter: { select: { title: true, course: { select: { title: true } } } } } },
    },
  });
  if (!response || response.block.type !== "OPEN_QUESTION") return null;
  const config = OpenQuestionConfigSchema.safeParse(response.block.config);
  const payload = OpenQuestionPayloadSchema.safeParse(response.payload);
  if (!config.success || !payload.success) return null;

  const prior = await prisma.response.findMany({
    where: { blockId: response.blockId, userId: response.userId, id: { not: response.id }, review: { isNot: null } },
    orderBy: { attempt: "desc" },
    take: 3,
    select: { review: { select: { feedback: true } } },
  });
  const answerParts = [payload.data.text.trim()];
  if (payload.data.url?.trim()) answerParts.push(`Submitted URL (not fetched): ${payload.data.url.trim()}`);

  return {
    courseTitle: response.block.chapter.course.title,
    chapterTitle: response.block.chapter.title,
    prompt: config.data.prompt,
    rubric: config.data.rubric,
    sampleAnswer: config.data.sampleAnswer,
    answer: answerParts.filter(Boolean).join("\n\n"),
    previousFeedback: prior.flatMap((item) => (item.review?.feedback ? [item.review.feedback] : [])),
    maxScore: response.block.points,
  };
}

async function underDailyCap(now = new Date()): Promise<boolean> {
  const used = await prisma.response.count({ where: { aiDraftAt: { gte: startOfUtcDay(now) } } });
  return used < env.AI_REVIEW_DAILY_LIMIT;
}

type Deps = { generate?: typeof generateReviewDraft; force?: boolean };

/** After a failure, wait this long before the queue tries the same answer again on its own. */
const RETRY_AFTER_MS = 30 * 60 * 1000;

async function markFailed(responseId: string, reason: string) {
  await prisma.response
    .update({ where: { id: responseId }, data: { aiDraftError: reason.slice(0, 300), aiDraftFailedAt: new Date() } })
    .catch(() => undefined);
}

/** A short reason for the mentor. Provider errors are already written for people; anything else stays generic. */
function failureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("Claude could not generate a draft: ")) return message.slice("Claude could not generate a draft: ".length);
  if (message.startsWith("Claude returned an unreadable")) return "Claude returned a draft we could not read.";
  return "Claude could not draft this one.";
}

/**
 * Make and save the platform draft for one pending open answer. Returns the saved draft,
 * or null when drafting is off (for the platform or for this course), capped, not an
 * open question, or the call failed.
 * `force` replaces an existing draft (the mentor's "Draft again").
 */
export async function ensureAutoDraft(responseId: string, deps: Deps = {}): Promise<StoredAiDraft | null> {
  const outcome = await draftWithReason(responseId, deps);
  return "draft" in outcome ? outcome.draft : null;
}

/**
 * Same as ensureAutoDraft, but says why there is no draft, so "Try again" can tell the
 * mentor the real reason instead of a generic "temporarily unavailable".
 */
export async function draftWithReason(responseId: string, deps: Deps = {}): Promise<{ draft: StoredAiDraft } | { reason: string }> {
  if (!aiReviewAutoDraftAvailable) return { reason: "Automatic drafting is switched off on the platform." };
  // A background draft for this answer is already running: wait for it instead of failing.
  for (let waited = 0; inFlight.has(responseId) && waited < 45_000; waited += 1_000) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (inFlight.has(responseId)) return { reason: "Claude is still working on this one. Try again in a minute." };
  const row = await prisma.response.findUnique({
    where: { id: responseId },
    select: {
      status: true,
      aiDraft: true,
      aiDraftModel: true,
      aiDraftCostMicroUsd: true,
      aiDraftFailedAt: true,
      block: { select: { chapter: { select: { course: { select: AI_GRADING_COURSE_SELECT } } } } },
    },
  });
  if (!row) return { reason: "This answer no longer exists." };
  if (row.status !== "PENDING_REVIEW") return { reason: "This answer is already reviewed." };
  const existing = readStoredDraft(row.aiDraft, row.aiDraftModel, row.aiDraftCostMicroUsd);
  if (existing && !deps.force) return { draft: existing };
  // A recent failure is not retried on every page load; "Try again" (force) always runs.
  if (!deps.force && row.aiDraftFailedAt && Date.now() - row.aiDraftFailedAt.getTime() < RETRY_AFTER_MS) {
    return { reason: "The last try failed. Press Try again." };
  }
  const settings = effectiveAiGrading(row.block.chapter.course);
  if (!settings.reviewDraft) return { reason: "AI drafts are off for this course. Turn them on in the course's AI grading settings." };
  if (!(await underDailyCap())) {
    return { reason: `Today's limit of ${env.AI_REVIEW_DAILY_LIMIT} AI drafts is used up. It resets at midnight UTC.` };
  }

  inFlight.add(responseId);
  try {
    const context = await loadReviewDraftContext(responseId);
    if (!context) {
      const reason = "This answer has no readable text to draft from. Review it by hand.";
      await markFailed(responseId, reason);
      return { reason };
    }
    const result = await (deps.generate ?? generateReviewDraft)(context, {
      provider: "ANTHROPIC",
      apiKey: env.ANTHROPIC_API_KEY,
      model: settings.model,
    });
    const draft = { ...result.draft, suggestedScore: Math.min(result.draft.suggestedScore, context.maxScore) };
    const costMicro = result.usage ? costMicroUsd(result.model, result.usage.inputTokens, result.usage.outputTokens) : null;
    await prisma.response.update({
      where: { id: responseId },
      data: {
        aiDraft: draft as Prisma.InputJsonValue,
        aiDraftModel: result.model,
        aiDraftAt: new Date(),
        aiDraftCostMicroUsd: costMicro,
        aiDraftError: null,
        aiDraftFailedAt: null,
      },
    });
    return { draft: { draft, model: result.model, costUsd: costMicro == null ? null : costMicro / 1_000_000 } };
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : "unknown", responseId }, "automatic review draft failed");
    const reason = failureReason(error);
    await markFailed(responseId, reason);
    return { reason };
  } finally {
    inFlight.delete(responseId);
  }
}

/** Draft the given answers in the background, a few at a time, without blocking the request. */
export function queueAutoDrafts(responseIds: string[]): void {
  if (!aiReviewAutoDraftAvailable || responseIds.length === 0) return;
  const batch = responseIds.filter((id) => !inFlight.has(id)).slice(0, BACKGROUND_BATCH);
  void (async () => {
    for (const id of batch) await ensureAutoDraft(id);
  })().catch((error) => logger.error({ err: error }, "automatic review drafts crashed"));
}
