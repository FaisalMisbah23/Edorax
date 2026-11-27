import Link from "next/link";
import { Inbox } from "lucide-react";
import type { ReviewedAnswersView } from "@/shared/api/teach";
import { serverApiFetch } from "@/lib/api-server";
import { AutoSubmitSelect } from "@/components/teach/auto-submit-select";
import { ReviewTabs } from "@/components/teach/review-tabs";
import { ReviewContextLinks } from "@/components/teach/review-context-links";
import { LocalDate } from "@/components/classes/local-date";

/** Answers already reviewed, newest review first: what was said, when, and whether a newer attempt followed. */
export async function ReviewedAnswers({ courseId, learnerId }: { courseId?: string; learnerId?: string }) {
  const params = new URLSearchParams();
  if (courseId) params.set("courseId", courseId);
  if (learnerId) params.set("learnerId", learnerId);
  const { courses, items, learner } = await serverApiFetch<ReviewedAnswersView>(`/api/v1/teach/review/reviewed${params.size ? `?${params}` : ""}`);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Reviewed answers <span className="text-muted-foreground">({items.length})</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Answers you or another mentor already approved or sent back, newest first. Open one to read the full exchange.</p>
        </div>
        {courses.length > 1 && (
          <form className="w-full sm:w-auto" action="/review" method="GET">
            <input type="hidden" name="status" value="reviewed" />
            <AutoSubmitSelect
              name="courseId"
              defaultValue={courseId ?? ""}
              aria-label="Filter by course"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring sm:w-72"
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>
        )}
      </div>

      <ReviewTabs active="reviewed" courseId={courseId} learnerId={learnerId} />

      {learner ? (
        <p className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
          Showing only {learner.label}.
          <Link href="/review?status=reviewed" className="font-medium text-primary hover:underline">
            Show everyone
          </Link>
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-2 text-center">
          <Inbox className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">Nothing reviewed yet</p>
          <p className="text-sm text-muted-foreground">Answers you review show up here.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border bg-card p-4 text-card-foreground">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    <Link href={item.learnerHref} className="underline-offset-2 hover:underline">
                      {item.learnerLabel}
                    </Link>
                    <span className="font-normal text-muted-foreground"> &middot; attempt {item.attempt}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Link href={`/courses/${encodeURIComponent(item.courseSlug)}`} className="underline-offset-2 hover:underline">
                      {item.courseTitle}
                    </Link>
                    {item.moduleTitle ? ` › ${item.moduleTitle}` : ""} ›{" "}
                    <Link href={item.chapterHref} className="underline-offset-2 hover:underline">
                      {item.chapterTitle}
                    </Link>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                  <span
                    className={`rounded-full px-2.5 py-0.5 ${
                      item.verdict === "APPROVED" ? "bg-ok-soft text-ok" : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                    }`}
                  >
                    {item.verdict === "APPROVED" ? "Approved" : "Sent back"}
                    {item.score !== null ? ` · ${item.score}/${item.maxScore}` : ""}
                  </span>
                  {item.superseded ? <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">Newer attempt sent</span> : null}
                </div>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Answered <LocalDate iso={item.submittedAt} withTime /> &middot; reviewed <LocalDate iso={item.reviewedAt} withTime />
                {item.reviewerName ? ` by ${item.reviewerName}` : ""}
              </p>

              <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-foreground">{item.feedback}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/review/${item.id}`}
                  className="inline-flex min-h-11 items-center rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 sm:min-h-8 sm:px-3"
                >
                  Open exchange
                </Link>
              </div>
              <ReviewContextLinks item={item} className="mt-2" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
