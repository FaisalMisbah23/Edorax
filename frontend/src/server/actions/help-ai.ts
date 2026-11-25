"use server";

import type { HelpReplyDraft, ThreadFeedbackView } from "@/shared/api/teach";
import { teachCall } from "./teach-call";
import { resolveHelpThread } from "./help";

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

/** Mark several learner questions resolved; one failure does not stop the rest. */
export async function resolveHelpThreads(input: { threadIds: string[] }): Promise<{ resolved: number; failed: number }> {
  let resolved = 0;
  let failed = 0;
  for (const threadId of [...new Set(input.threadIds)].slice(0, 200)) {
    const result = await resolveHelpThread({ threadId });
    if (result.ok) resolved += 1;
    else failed += 1;
  }
  return { resolved, failed };
}
