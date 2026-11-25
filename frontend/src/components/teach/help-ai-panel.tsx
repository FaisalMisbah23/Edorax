"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag, Sparkles } from "lucide-react";
import type { HelpReplyDraft, ThreadFeedbackView } from "@/shared/api/teach";
import { draftHelpReply, setThreadFeedback } from "@/server/actions/help-ai";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/components/teach/format-usd";

export const HELP_REPLY_DRAFT_EVENT = "edorax:help-reply-draft";

// Mentor tools above a question thread: ask Claude for a reply to edit and send, and
// flag the thread as feedback for the team when it points at a course or platform problem.

export function HelpAiPanel({ threadId, canDraft, initialFeedback }: { threadId: string; canDraft: boolean; initialFeedback: ThreadFeedbackView }) {
  const router = useRouter();
  const [draft, setDraft] = useState<HelpReplyDraft | null>(null);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [error, setError] = useState<string | null>(null);
  const [drafting, startDrafting] = useTransition();
  const [flagging, startFlagging] = useTransition();

  function suggest() {
    startDrafting(async () => {
      setError(null);
      const result = await draftHelpReply({ threadId });
      if (!result.ok) setError(result.error);
      else setDraft(result.draft);
    });
  }

  function flag(scope: "COURSE" | "PLATFORM" | null, note?: string | null) {
    startFlagging(async () => {
      setError(null);
      const result = await setThreadFeedback({ threadId, scope, note: note ?? null });
      if (!result.ok) setError(result.error);
      else {
        setFeedback(result.feedback);
        router.refresh();
      }
    });
  }

  return (
    <section aria-label="Mentor tools" className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {canDraft ? (
          <Button type="button" size="sm" variant="outline" onClick={suggest} loading={drafting} disabled={drafting}>
            <Sparkles aria-hidden /> {draft ? "Suggest again" : "Suggest a reply with AI"}
          </Button>
        ) : null}
        {feedback.scope ? (
          <>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-500/15 px-3 text-xs font-medium text-amber-800 dark:text-amber-200">
              <Flag className="size-3.5" aria-hidden /> Flagged as {feedback.scope === "PLATFORM" ? "platform" : "course"} feedback
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => flag(null)} disabled={flagging}>
              Remove flag
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="sm" variant="ghost" onClick={() => flag("COURSE", draft?.feedbackNote)} disabled={flagging}>
              <Flag aria-hidden /> Course problem
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => flag("PLATFORM", draft?.feedbackNote)} disabled={flagging}>
              <Flag aria-hidden /> Platform problem
            </Button>
          </>
        )}
      </div>

      {feedback.scope && feedback.note ? <p className="mt-2 text-xs text-muted-foreground">Note for the team: {feedback.note}</p> : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {draft ? (
        <div className="mt-3 rounded-lg border bg-muted/30 p-3" aria-live="polite">
          <p className="text-xs text-muted-foreground">
            Claude&apos;s suggestion · {draft.model}
            {draft.costUsd != null ? ` · ${formatUsd(draft.costUsd)}` : ""}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{draft.reply}</p>
          {draft.feedbackScope !== "NONE" && !feedback.scope ? (
            <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200">
              This looks like a {draft.feedbackScope === "PLATFORM" ? "platform" : "course"} problem{draft.feedbackNote ? `: ${draft.feedbackNote}` : "."} Flag it above so it reaches the team.
            </p>
          ) : null}
          <div className="mt-3">
            <Button
              type="button"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent(HELP_REPLY_DRAFT_EVENT, { detail: draft.reply }))}
            >
              Use this reply
            </Button>
            <span className="ml-2 text-xs text-muted-foreground">It goes into the reply box. You can edit it before you send.</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
