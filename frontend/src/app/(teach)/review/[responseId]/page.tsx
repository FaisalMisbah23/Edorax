import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReviewDetailView } from "@/shared/api/teach";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetchOrNotFound } from "@/lib/api-server";
import { submitReview } from "@/server/actions/reviews";
import { ReviewForm } from "@/components/teach/review-form";
import { QuizIntegrity } from "@/components/teach/evaluation/quiz-integrity";
import { CapstoneReport, capstoneDraftFeedback } from "@/components/teach/evaluation/capstone-report";
import { ReviewContextLinks } from "@/components/teach/review-context-links";
import { formatUsd } from "@/components/teach/format-usd";
import { AttemptTimeline } from "@/components/teach/evaluation/attempt-timeline";
import { LocalDate } from "@/components/classes/local-date";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const { responseId } = await params;
  await requireTeachSurface();

  const response = await serverApiFetchOrNotFound<ReviewDetailView>(
    `/api/v1/teach/review/${encodeURIComponent(responseId)}`
  );
  const { course, question, history } = response;
  const alreadyReviewed = response.status !== "PENDING_REVIEW";
  const reviewResponseId = response.id;
  const capstone = response.capstone;
  const capstonePercent = capstone?.current?.report?.percent ?? null;

  async function submitReviewAction(formData: FormData) {
    "use server";
    const verdict = formData.get("verdict") === "APPROVED" ? "APPROVED" : "NEEDS_REVISION";
    const feedback = String(formData.get("feedback") ?? "");
    const rawScore = String(formData.get("score") ?? "");
    const result = await submitReview({
      responseId: reviewResponseId,
      verdict,
      feedback,
      score: rawScore === "" ? undefined : Number(rawScore),
    });
    if (result.ok) redirect("/review");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/review"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to queue
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            <Link href={`/courses/${encodeURIComponent(course.slug)}`} className="underline-offset-2 hover:underline">
              {course.title}
            </Link>
            {response.moduleTitle ? ` › ${response.moduleTitle}` : ""}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {response.chapterTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={response.learnerHref} className="underline-offset-2 hover:underline">
              {response.learner.name ?? response.learner.email}
            </Link>{" "}
            · attempt {response.attempt} ·{" "}
            answered on <LocalDate iso={response.submittedAt} withTime />
          </p>
          <ReviewContextLinks item={response} className="mt-3" />
        </div>
        {response.status === "PENDING_REVIEW" && (
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            Pending review
          </span>
        )}
      </div>

      {capstone ? null : <AttemptTimeline attempts={history} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {capstone ? <CapstoneReport capstone={capstone} /> : null}
        {/* Left: the question, rubric, and reference answer, mentor-only config */}
        {capstone ? null : <section className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
          <h2 className="text-sm font-semibold">Question</h2>
          <p className="mt-2 text-[15px] font-medium leading-snug">
            {question?.prompt ?? "(prompt unavailable)"}
          </p>

          {question && question.minWords > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Minimum {question.minWords} words
              {question.maxWords ? ` · maximum ${question.maxWords}` : ""}
            </p>
          )}

          {question?.rubric && (
            <div className="mt-4 rounded-lg border bg-muted/40 p-4">
              <h3 className="text-xs font-medium text-muted-foreground">Rubric (mentor only)</h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{question.rubric}</p>
            </div>
          )}

          {question?.sampleAnswer && (
            <div className="mt-3 rounded-lg border bg-muted/40 p-4">
              <h3 className="text-xs font-medium text-muted-foreground">
                Reference answer (mentor only)
              </h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{question.sampleAnswer}</p>
            </div>
          )}

        </section>}

        {/* Right: the mentee's answer + review form */}
        <section className="flex flex-col gap-4">
          {capstone ? null : <div className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
            <h2 className="text-sm font-semibold">Mentee&apos;s answer</h2>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">
              {response.answerText}
            </p>
            {response.answerUrl ? (
              <p className="mt-3 text-sm">
                <span className="font-medium">Submitted link: </span>
                <a href={response.answerUrl} className="break-all text-primary underline underline-offset-2" target="_blank" rel="noreferrer noopener">
                  {response.answerUrl}
                </a>
              </p>
            ) : null}
          </div>}

          {alreadyReviewed ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
              Already reviewed:{" "}
              {response.status === "REVIEWED" ? "approved" : "sent back for revision"}
              {response.review?.score !== null && response.review?.score !== undefined
                ? ` with score ${response.review.score}/${response.block.points}`
                : ""}
              .
            </div>
          ) : (
            <ReviewForm
              responseId={reviewResponseId}
              maxScore={response.block.points}
              action={submitReviewAction}
              {...(capstone
                ? {
                    aiDraft: false,
                    initialFeedback: capstoneDraftFeedback(capstone.current),
                    initialScore: capstonePercent === null ? null : Math.round((capstonePercent / 100) * response.block.points),
                    note: "Prefilled from the AI check. Approve to confirm it, or change the feedback, score or verdict to override it. Only an approval counts toward the certificate.",
                  }
                : {
                    initialDraft: response.aiDraft?.draft ?? null,
                    initialModel: response.aiDraft
                      ? `${response.aiDraft.model}${response.aiDraft.costUsd != null ? ` · ${formatUsd(response.aiDraft.costUsd)}` : ""}`
                      : null,
                    platformDraft: response.platformDraft,
                    ...(response.aiDraft ? { note: "Prefilled from Claude's first pass. Check it, edit if needed, then approve or send it back." } : {}),
                  })}
            />
          )}
        </section>
      </div>

      {response.integrity.length > 0 ? (
        <div className="mt-6">
          <QuizIntegrity attempts={response.integrity} showChapter={false} />
        </div>
      ) : null}
    </div>
  );
}
