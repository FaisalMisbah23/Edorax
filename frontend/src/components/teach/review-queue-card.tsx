"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, ExternalLink, RotateCcw, Sparkles } from "lucide-react";
import type { ReviewQueueItem } from "@/shared/api/teach";
import { submitReview } from "@/server/actions/reviews";
import { archiveReviewResponse } from "@/server/actions/ai-review";
import { Button } from "@/components/ui/button";
import { ReviewContextLinks } from "@/components/teach/review-context-links";
import { formatUsd } from "@/components/teach/format-usd";

// One answer, reviewed where it sits: the question, what the learner wrote, the feedback
// (Claude's draft, editable) and the three things a mentor can do: approve, send back, archive.

const CLAMP_CHARS = 420;

/** The answer was reviewed or archived from another tab or device: nothing left to do here. */
function alreadyHandled(message: string) {
  return message.includes("already been reviewed");
}

function Clamped({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > CLAMP_CHARS;
  return (
    <>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{long && !open ? `${text.slice(0, CLAMP_CHARS)}…` : text}</p>
      {long ? (
        <button type="button" onClick={() => setOpen((value) => !value)} className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline sm:min-h-0 sm:text-xs">
          {open ? "Show less" : "Show all"}
        </button>
      ) : null}
    </>
  );
}

export function ReviewQueueCard({ item, ageLabel, autoDraft }: { item: ReviewQueueItem; ageLabel: string | null; autoDraft: boolean }) {
  const router = useRouter();
  const draft = item.aiDraft;
  const isCapstone = item.blockType === "CAPSTONE_CHECK";
  const [feedback, setFeedback] = useState(draft?.feedback ?? "");
  const [score, setScore] = useState(draft ? String(draft.suggestedScore) : "");
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [gone, setGone] = useState(false);
  const [pending, startTransition] = useTransition();

  function send(verdict: "APPROVED" | "NEEDS_REVISION") {
    if (!feedback.trim()) {
      setError("Write a line of feedback first. The learner sees it.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await submitReview({ responseId: item.id, verdict, feedback: feedback.trim(), score: score === "" ? undefined : Number(score) });
      if (!result.ok && !alreadyHandled(result.errors.join(" "))) setError(result.errors.join(" "));
      else {
        setGone(true);
        router.refresh();
      }
    });
  }

  function archive() {
    startTransition(async () => {
      setError(null);
      const result = await archiveReviewResponse({ responseId: item.id });
      if (!result.ok && !alreadyHandled(result.error)) setError(result.error);
      else {
        setGone(true);
        router.refresh();
      }
    });
  }

  if (gone) return null;
  const suggestApprove = draft?.suggestedVerdict === "APPROVED";

  return (
    <li className={`rounded-xl border bg-card p-4 text-card-foreground ${ageLabel ? "border-amber-400/50" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {item.learnerLabel}
            <span className="font-normal text-muted-foreground"> · attempt {item.attempt}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.courseTitle}
            {item.moduleTitle ? ` › ${item.moduleTitle}` : ""} › {item.chapterTitle}
          </p>
        </div>
        {ageLabel ? <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">{ageLabel}</span> : null}
      </div>

      <ReviewContextLinks item={item} className="mt-3" />

      {item.questionPrompt ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Question</p>
          <Clamped text={item.questionPrompt} />
        </div>
      ) : null}

      {isCapstone ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Capstone project. The AI check already graded it: read the report, then approve or send it back.</p>
          <Link href={`/review/${item.id}`} className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Open the capstone report
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-lg border bg-background p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Learner&apos;s answer</p>
            {item.answerText ? <Clamped text={item.answerText} /> : item.answerText === undefined ? <p className="text-sm text-muted-foreground">Open the full page to read the answer.</p> : <p className="text-sm text-muted-foreground">No text in this answer.</p>}
            {item.answerUrl ? (
              <a href={item.answerUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 break-all text-sm text-primary underline underline-offset-2">
                <ExternalLink className="size-3.5 shrink-0" aria-hidden /> {item.answerUrl}
              </a>
            ) : null}
          </div>

          <div className="mt-3 rounded-lg border bg-muted/30 p-3">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
              {draft ? (
                <>
                  <Sparkles className="size-3.5" aria-hidden />
                  Claude suggests: {suggestApprove ? "approve" : "needs revision"}
                  <span className="font-normal text-muted-foreground">
                    · {draft.confidence.toLowerCase()} confidence
                    {item.aiDraftModel ? ` · ${item.aiDraftModel}` : ""}
                    {item.aiDraftCostUsd != null ? ` · ${formatUsd(item.aiDraftCostUsd)}` : ""}
                  </span>
                </>
              ) : (
                <span className="font-normal text-muted-foreground">
                  {autoDraft && item.blockType === "OPEN_QUESTION" ? "Claude is still drafting this one. Refresh in a minute, or write your own feedback." : "Write your feedback."}
                </span>
              )}
            </p>
            <label className="mt-2 block">
              <span className="sr-only">Feedback for the learner</span>
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                rows={draft ? 4 : 2}
                maxLength={5000}
                placeholder="What worked, what to fix, what to read next"
                disabled={pending}
                className="w-full rounded-lg border border-input bg-background p-2.5 text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Score
                <input
                  type="number"
                  min={0}
                  max={item.maxScore}
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                  disabled={pending}
                  className="h-9 w-16 rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                / {item.maxScore}
              </label>
              <Button type="button" size="sm" variant={suggestApprove || !draft ? "default" : "outline"} onClick={() => send("APPROVED")} disabled={pending}>
                <CheckCircle2 aria-hidden /> Approve
              </Button>
              <Button type="button" size="sm" variant={draft && !suggestApprove ? "default" : "outline"} onClick={() => send("NEEDS_REVISION")} disabled={pending}>
                <RotateCcw aria-hidden /> Send back
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
        {confirmArchive ? (
          <>
            <span className="text-muted-foreground">Remove from this list without sending feedback?</span>
            <Button type="button" size="sm" variant="outline" onClick={archive} disabled={pending}>
              Yes, archive
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmArchive(false)} disabled={pending}>
              Keep
            </Button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setConfirmArchive(true)} className="inline-flex min-h-11 items-center gap-1 pr-2 font-medium text-muted-foreground hover:text-foreground sm:min-h-0">
              <Archive className="size-3.5" aria-hidden /> Archive
            </button>
            <Link href={`/review/${item.id}`} className="inline-flex min-h-11 items-center font-medium text-muted-foreground hover:text-foreground sm:min-h-0">
              Open full page
            </Link>
          </>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
