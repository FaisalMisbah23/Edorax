import { Inbox } from "lucide-react";
import type { ReviewQueueView } from "@/shared/api/teach";
import { nowMs } from "@/server/time";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetch } from "@/lib/api-server";
import { AutoSubmitSelect } from "@/components/teach/auto-submit-select";
import { ReviewQueueCard } from "@/components/teach/review-queue-card";
import { AcceptAllAiDraftsButton } from "@/components/teach/accept-all-ai-drafts-button";
import { formatUsd } from "@/components/teach/format-usd";

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
              ? `Claude drafts a first review of each answer. ${drafted} of ${items.length} ready: read the answer, edit the feedback if needed, then approve or send it back right here.`
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
            {sendable.length} drafted {sendable.length === 1 ? "review is" : "reviews are"} ready to send.
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
            const ageHours = (now - new Date(response.submittedAt).getTime()) / (1000 * 60 * 60);
            const ageLabel = ageHours < AGING_HOURS ? null : Math.floor(ageHours / 24) >= 1 ? `${Math.floor(ageHours / 24)}d waiting` : `${Math.floor(ageHours)}h waiting`;
            return <ReviewQueueCard key={response.id} item={response} ageLabel={ageLabel} autoDraft={autoDraft} />;
          })}
        </ul>
      )}
    </div>
  );
}
