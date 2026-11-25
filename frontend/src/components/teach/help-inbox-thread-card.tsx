"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Flag, SendHorizontal } from "lucide-react";
import type { MentorHelpInboxThread } from "@/shared/api/teach";
import { replyToHelpThread, resolveHelpThread } from "@/server/actions/help";
import { setThreadFeedback } from "@/server/actions/help-ai";
import { AiReplyButton, aiNoteFor } from "@/components/help/ai-reply-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A learner question as a small chat the mentor answers in place: the last messages,
// a reply box with an AI draft, and Send, Send and resolve, Mark resolved on the card.

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0]![0]! + parts[1]![0]! : name.slice(0, 2)).toUpperCase();
}

function waitLabel(hours: number) {
  return hours >= 48 ? `${Math.floor(hours / 24)} days` : hours >= 1 ? `${Math.floor(hours)} h` : "under an hour";
}

export function HelpInboxThreadCard({
  thread,
  selected = false,
  onSelect,
}: {
  thread: MentorHelpInboxThread;
  selected?: boolean;
  /** Present when the thread can be picked for a bulk action. */
  onSelect?: (on: boolean) => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flag, setFlag] = useState(thread.feedbackScope);
  const [gone, setGone] = useState(false);
  const [pending, startTransition] = useTransition();
  const open = thread.status === "OPEN";
  // The website can deploy a minute before the API: fall back to the one-line preview until it catches up.
  const messages =
    thread.messages ??
    (thread.preview ? [{ id: "preview", body: thread.preview.body, fromLearner: true, authorName: thread.menteeLabel, createdAt: thread.preview.createdAt }] : []);
  const earlier = Math.max(0, (thread.messageCount ?? messages.length) - messages.length);

  function run(work: () => Promise<string | null>, hide = false) {
    startTransition(async () => {
      setError(null);
      const problem = await work();
      if (problem) setError(problem);
      else {
        setBody("");
        setNote(null);
        if (hide) setGone(true);
        router.refresh();
      }
    });
  }

  const send = (thenResolve: boolean) =>
    run(async () => {
      const sent = await replyToHelpThread({ threadId: thread.id, body: body.trim() });
      if (!sent.ok) return sent.error;
      if (!thenResolve) return null;
      const closed = await resolveHelpThread({ threadId: thread.id });
      return closed.ok ? null : closed.error;
    }, thenResolve);

  const resolve = () =>
    run(async () => {
      const closed = await resolveHelpThread({ threadId: thread.id });
      return closed.ok ? null : closed.error;
    }, true);

  const setFeedback = (scope: "COURSE" | "PLATFORM" | null) =>
    startTransition(async () => {
      setError(null);
      const result = await setThreadFeedback({ threadId: thread.id, scope, note: null });
      if (!result.ok) setError(result.error);
      else setFlag(result.feedback.scope);
    });

  if (gone) return null;

  return (
    <li className={cn("rounded-2xl border bg-card p-4 sm:p-5", thread.needsReply ? "border-amber-400/60" : "border-border")}>
      <div className="flex items-start gap-3">
        {onSelect ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect(event.target.checked)}
            aria-label={`Select ${thread.menteeLabel}'s question`}
            className="mt-3 size-4 shrink-0 accent-[var(--primary)]"
          />
        ) : null}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary" aria-hidden>
          {initials(thread.menteeLabel)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/help/${thread.id}`} className="truncate text-[15px] font-semibold text-foreground hover:underline">
              {thread.menteeLabel}
            </Link>
            {!open ? (
              <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-[11px] font-semibold text-ok">Resolved</span>
            ) : thread.needsReply ? (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                Needs your reply · waiting {waitLabel(thread.ageHours)}
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">You replied · waiting on learner</span>
            )}
            {thread.kind === "LESSON_REPORT" ? (
              <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
                Lesson report{thread.category ? ` · ${thread.category.toLowerCase().replace("_", " ")}` : ""}
              </span>
            ) : null}
            {flag ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{flag === "PLATFORM" ? "Platform feedback" : "Course feedback"}</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {thread.courseTitle}
            {thread.chapterTitle ? ` › ${thread.chapterTitle}` : ""}
          </p>
        </div>
      </div>

      {thread.quote ? <p className="mt-3 border-l-2 pl-3 text-sm italic text-muted-foreground">&ldquo;{thread.quote}&rdquo;</p> : null}

      <div className="mt-3 space-y-2">
        {earlier > 0 ? (
          <Link href={`/help/${thread.id}`} className="block text-xs font-medium text-primary hover:underline">
            {earlier} earlier {earlier === 1 ? "message" : "messages"}: open the full chat
          </Link>
        ) : null}
        {messages.map((message) => (
          <div key={message.id} className={cn("flex", message.fromLearner ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-[92%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed sm:max-w-[80%]",
                message.fromLearner ? "rounded-tl-sm border bg-background text-foreground" : "rounded-tr-sm bg-primary/10 text-foreground"
              )}
            >
              <p className="text-[11px] font-semibold text-muted-foreground">
                {message.fromLearner ? message.authorName : "You"} · {new Date(message.createdAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{message.body}</p>
            </div>
          </div>
        ))}
      </div>

      {open ? (
        <div className="mt-3">
          {note ? <p className="mb-1.5 text-xs text-muted-foreground">{note}</p> : null}
          <div className="flex items-end gap-2 rounded-2xl border bg-background p-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Reply to {thread.menteeLabel}</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={body.length > 160 ? 5 : 2}
                maxLength={4000}
                placeholder="Type a reply"
                disabled={pending}
                className="w-full resize-y bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <AiReplyButton
              threadId={thread.id}
              onDraft={(draft) => {
                setBody(draft.reply);
                setNote(aiNoteFor(draft));
              }}
              onError={setError}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => send(false)} disabled={pending || !body.trim()}>
              <SendHorizontal aria-hidden /> Send
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => send(true)} disabled={pending || !body.trim()}>
              Send and resolve
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={resolve} disabled={pending}>
              <CheckCircle2 aria-hidden /> Mark resolved
            </Button>
            <span className="ml-auto flex flex-wrap items-center gap-x-3 text-xs">
              {flag ? (
                <button type="button" onClick={() => setFeedback(null)} disabled={pending} className="font-medium text-muted-foreground hover:text-foreground">
                  Remove feedback flag
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setFeedback("COURSE")} disabled={pending} className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
                    <Flag className="size-3.5" aria-hidden /> Course problem
                  </button>
                  <button type="button" onClick={() => setFeedback("PLATFORM")} disabled={pending} className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
                    <Flag className="size-3.5" aria-hidden /> Platform problem
                  </button>
                </>
              )}
            </span>
          </div>
        </div>
      ) : (
        <Link href={`/help/${thread.id}`} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
          Open the full chat
        </Link>
      )}

      {error ? (
        <p role="alert" className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
