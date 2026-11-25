"use server";

import type { HelpReplyDraft, ThreadFeedbackView } from "@/shared/api/teach";
import { teachCall } from "./teach-call";

/** Claude's suggested reply to a learner question; the mentor edits and sends it. */
export async function draftHelpReply(input: { threadId: string }): Promise<{ ok: true; draft: HelpReplyDraft } | { ok: false; error: string }> {
  const result = await teachCall<HelpReplyDraft>(`/api/v1/teach/help/threads/${encodeURIComponent(input.threadId)}/ai-draft`, { method: "POST" });
  if (!result.ok) return { ok: false, error: result.errors.join(" ") };
  return { ok: true, draft: result.data };
}

/** Flag a thread as course or platform feedback for the team, or clear the flag. */
export async function setThreadFeedback(input: {
  threadId: string;
  scope: "COURSE" | "PLATFORM" | null;
  note: string | null;
}): Promise<{ ok: true; feedback: ThreadFeedbackView } | { ok: false; error: string }> {
  const result = await teachCall<ThreadFeedbackView>(`/api/v1/teach/help/threads/${encodeURIComponent(input.threadId)}/feedback`, {
    method: "PUT",
    json: { scope: input.scope, note: input.note },
  });
  if (!result.ok) return { ok: false, error: result.errors.join(" ") };
  return { ok: true, feedback: result.data };
}
