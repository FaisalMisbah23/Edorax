import Link from "next/link";
import type { ReviewDetailView } from "@/shared/api/teach";
import { LocalDate } from "@/components/classes/local-date";

type Attempt = ReviewDetailView["history"][number];

/**
 * Every answer the learner sent for this question and every reply they got, oldest first,
 * each with its date, so the mentor can follow the exchange without guessing what came when.
 */
export function AttemptTimeline({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length < 2 && !attempts.some((attempt) => attempt.review)) return null;
  const currentIndex = attempts.findIndex((attempt) => attempt.current);
  const newer = currentIndex >= 0 ? attempts.slice(currentIndex + 1) : [];
  const latest = newer.at(-1);

  return (
    <section aria-labelledby="attempt-timeline-title" className="mt-6 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
      <h2 id="attempt-timeline-title" className="text-sm font-semibold">
        Timeline
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Every answer and every reply on this question, oldest first.
      </p>

      {latest ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          You are looking at attempt {attempts[currentIndex]!.attempt}. A newer answer came in on{" "}
          <LocalDate iso={latest.submittedAt} withTime />.{" "}
          <Link href={`/review/${latest.id}`} className="font-medium underline underline-offset-2">
            Open attempt {latest.attempt}
          </Link>
        </p>
      ) : null}

      <ol className="mt-4 space-y-4 border-l pl-4">
        {attempts.map((attempt, index) => (
          <li key={attempt.id} className="relative">
            <span aria-hidden className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-sm font-semibold">Attempt {attempt.attempt}</p>
              {attempt.current ? (
                <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                  This page
                </span>
              ) : (
                <Link href={`/review/${attempt.id}`} className="text-xs text-primary underline underline-offset-2">
                  Open
                </Link>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Learner answered on <LocalDate iso={attempt.submittedAt} withTime />
            </p>

            {attempt.current ? (
              <p className="mt-1.5 text-xs text-muted-foreground">The full answer is under Mentee&apos;s answer.</p>
            ) : (
              <details className="mt-1.5 rounded-lg border bg-muted/30 p-3" open={index === currentIndex - 1}>
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Their answer</summary>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{attempt.answerText}</p>
              </details>
            )}

            {attempt.review ? (
              <div
                className={`mt-2 rounded-lg border p-3 ${
                  attempt.review.verdict === "APPROVED"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-amber-500/30 bg-amber-500/5"
                }`}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {attempt.review.verdict === "APPROVED" ? "Approved" : "Sent back for revision"} by{" "}
                  {attempt.review.reviewerName ?? "a mentor"} on <LocalDate iso={attempt.review.reviewedAt} withTime />
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{attempt.review.feedback}</p>
              </div>
            ) : (
              <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">Waiting for review</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
