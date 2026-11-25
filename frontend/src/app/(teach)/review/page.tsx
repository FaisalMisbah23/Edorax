import Link from "next/link";
import { ChevronRight, Inbox, Sparkles } from "lucide-react";
import type { ReviewQueueView } from "@/shared/api/teach";
import { nowMs } from "@/server/time";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetch } from "@/lib/api-server";
import { AutoSubmitSelect } from "@/components/teach/auto-submit-select";
import { AcceptAiDraftButton } from "@/components/teach/accept-ai-draft-button";
import { AcceptAllAiDraftsButton } from "@/components/teach/accept-all-ai-drafts-button";
import { formatUsd } from "@/components/teach/format-usd";
import { ReviewContextLinks } from "@/components/teach/review-context-links";

const AGING_HOURS = 48;

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  await requireTeachSurface();
  const { courseId: courseFilter } = await searchParams;
  const query = courseFilter ? `?courseId=${encodeURIComponent(courseFilter)}` : "";
  const { courses, items, autoDraft, draftCostUsd } = await serverApiFetch<ReviewQueueView>(`/api/v1/teach/review${query}`);
  const now = nowMs();
  const draftedItems = items.filter((item) => item.aiDraft);
  const drafted = draftedItems.length;
  // "Send all" leaves out drafts Claude was unsure about, so those get a human read.
  const sendable = draftedItems.filter((item) => item.aiDraft?.confidence !== "LOW");
  const unsure = drafted - sendable.length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Answers to check <span className="text-muted-foreground">({items.length})</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {autoDraft
              ? `Claude drafts a first review of each answer. ${drafted} of ${items.length} ready: read it, then send it or open the answer to edit.`
              : "Open answers waiting for your feedback, oldest first."}
          </p>
        </div>

        {courses.length > 1 && (
          <form className="w-full sm:w-auto" action="/review" method="GET">
            <AutoSubmitSelect
              name="courseId"
              defaultValue={courseFilter ?? ""}
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

      {sendable.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {sendable.length} drafted reviews are ready to send.
            {unsure > 0 ? ` ${unsure} more are low confidence and stay for you to read.` : ""}
            {draftCostUsd > 0 ? ` Drafts on this page cost ${formatUsd(draftCostUsd)} in total.` : ""}
          </p>
          <AcceptAllAiDraftsButton
            responseIds={sendable.map((item) => item.id)}
            approveCount={sendable.filter((item) => item.aiDraft?.suggestedVerdict === "APPROVED").length}
            reviseCount={sendable.filter((item) => item.aiDraft?.suggestedVerdict !== "APPROVED").length}
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-2 text-center">
          <Inbox className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Nothing waiting</p>
          <p className="text-sm text-muted-foreground">
            When learners submit open answers in your courses, they appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((response) => {
            const submittedAt = new Date(response.submittedAt);
            const ageHours = (now - submittedAt.getTime()) / (1000 * 60 * 60);
            const isAging = ageHours >= AGING_HOURS;
            const draft = response.aiDraft;

            return (
              <li
                key={response.id}
                className={`rounded-xl border bg-card p-4 text-card-foreground ${
                  isAging ? "border-amber-400/50" : "border-border"
                }`}
              >
                <Link href={`/review/${response.id}`} className="group flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground group-hover:underline">
                      {response.learnerLabel}
                      <span className="font-normal text-muted-foreground"> · attempt {response.attempt}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {response.courseTitle}
                      {response.moduleTitle ? ` › ${response.moduleTitle}` : ""} › {response.chapterTitle}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isAging && (
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                        {Math.floor(ageHours / 24) >= 1 ? `${Math.floor(ageHours / 24)}d` : `${Math.floor(ageHours)}h`}
                      </span>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>

                <ReviewContextLinks item={response} className="mt-3" />

                {draft ? (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
                      <Sparkles className="size-3.5" aria-hidden />
                      Claude suggests: {draft.suggestedVerdict === "APPROVED" ? "approve" : "needs revision"}
                      <span className="text-muted-foreground">
                        · {draft.suggestedScore}/{response.maxScore} · {draft.confidence.toLowerCase()} confidence
                        {response.aiDraftModel ? ` · ${response.aiDraftModel}` : ""}
                        {response.aiDraftCostUsd != null ? ` · ${formatUsd(response.aiDraftCostUsd)}` : ""}
                      </span>
                    </p>
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed">{draft.feedback}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <AcceptAiDraftButton responseId={response.id} approve={draft.suggestedVerdict === "APPROVED"} />
                      <Link
                        href={`/review/${response.id}`}
                        className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-foreground hover:bg-muted/50"
                      >
                        Edit first
                      </Link>
                    </div>
                  </div>
                ) : autoDraft && response.blockType === "OPEN_QUESTION" ? (
                  <p className="mt-3 text-xs text-muted-foreground">Claude is drafting a review. Refresh in a minute.</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
