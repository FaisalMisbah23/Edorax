"use client";

import { useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { HelpReplyDraft } from "@/shared/api/teach";
import { draftHelpReply } from "@/server/actions/help-ai";

/** One line under the reply box saying who wrote the draft, what it cost and what to check. */
export function aiNoteFor(draft: HelpReplyDraft): string {
  const cost = draft.costUsd == null ? "" : ` · $${draft.costUsd < 0.01 ? draft.costUsd.toFixed(4) : draft.costUsd.toFixed(3)}`;
  const flag =
    draft.feedbackScope === "NONE"
      ? ""
      : ` This looks like a ${draft.feedbackScope === "PLATFORM" ? "platform" : "course"} problem${draft.feedbackNote ? `: ${draft.feedbackNote}` : "."} You can flag it above.`;
  return `Drafted by ${draft.model}${cost}. Check it, edit it, then send.${flag}`;
}

/**
 * Sits next to the send button in the mentor's reply box. One tap asks Claude for a reply
 * and puts it in the box; the mentor edits and sends it. Nothing is sent automatically.
 */
export function AiReplyButton({
  threadId,
  onDraft,
  onError,
}: {
  threadId: string;
  onDraft: (draft: HelpReplyDraft) => void;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Write a reply with AI"
      title="Write a reply with AI"
      onClick={() =>
        startTransition(async () => {
          const result = await draftHelpReply({ threadId });
          if (result.ok) onDraft(result.draft);
          else onError(result.error);
        })
      }
      className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 text-sm font-medium text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
      <span>{pending ? "Writing" : "AI"}</span>
    </button>
  );
}
