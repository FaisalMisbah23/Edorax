"use server";

import type { AcceptAiDraftsResult, AiReviewDraft, AiReviewDraftResult } from "@/shared/api/teach";
import { teachCall } from "./teach-call";

export type AiReviewActionResult =
  | { ok: true; draft: AiReviewDraft; model: string; costUsd: number | null }
  | { ok: false; error: string };

/** Send many saved AI first passes at once, each with Claude's suggested verdict. */
export async function acceptAllAiReviewDrafts(input: { responseIds: string[] }): Promise<{ ok: true; sent: number; failed: number } | { ok: false; error: string }> {
  const result = await teachCall<AcceptAiDraftsResult>("/api/v1/teach/review/accept-ai-drafts", { method: "POST", json: { responseIds: input.responseIds } });
  if (!result.ok) return { ok: false, error: result.errors.join(" ") };
  return { ok: true, sent: result.data.sent, failed: result.data.failed };
}

/** Send the saved AI first pass as the review, unchanged. */
export async function acceptAiReviewDraft(input: { responseId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await teachCall<null>(`/api/v1/teach/review/${encodeURIComponent(input.responseId)}/accept-ai-draft`, { method: "POST" });
  if (!result.ok) return { ok: false, error: result.errors.join(" ") };
  return { ok: true };
}

/** Advisory AI draft (platform Claude, or the mentor's own key); the mentor still edits and submits. */
export async function generateAiReviewDraft(input: { responseId: string }): Promise<AiReviewActionResult> {
  const result = await teachCall<AiReviewDraftResult>(`/api/v1/teach/review/${encodeURIComponent(input.responseId)}/ai-draft`, { method: "POST" });
  if (!result.ok) return { ok: false, error: result.errors.join(" ") };
  return { ok: true, draft: result.data.draft, model: result.data.model, costUsd: result.data.costUsd ?? null };
}
