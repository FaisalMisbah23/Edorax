"use server";

import type { AiReviewDraft, AiReviewDraftResult } from "@/shared/api/teach";
import { teachCall } from "./teach-call";

export type AiReviewActionResult =
  | { ok: true; draft: AiReviewDraft; model: string }
  | { ok: false; error: string };

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
  return { ok: true, draft: result.data.draft, model: result.data.model };
}
