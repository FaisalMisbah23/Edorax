import Link from "next/link";
import { HelpInboxList } from "@/components/teach/help-inbox-list";
import { Inbox } from "lucide-react";
import type { MentorHelpInboxView } from "@/shared/api/teach";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetch } from "@/lib/api-server";
import { AutoSubmitSelect } from "@/components/teach/auto-submit-select";
import { helpUiCopy as copy } from "@/shared/lib/help-ui-copy";



export default async function MentorHelpInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string; status?: string; kind?: string; learnerId?: string }>;
}) {
  await requireTeachSurface();
  const { courseId: courseFilter, status: rawStatus, kind: rawKind, learnerId } = await searchParams;
  const statusFilter =
    rawStatus === "resolved" || rawStatus === "all" ? rawStatus : undefined;
  const kindFilter =
    rawKind === "questions" || rawKind === "reports" ? rawKind : undefined;

  const query = new URLSearchParams();
  if (courseFilter) query.set("courseId", courseFilter);
  if (statusFilter) query.set("status", statusFilter);
  if (kindFilter) query.set("kind", kindFilter);
  if (learnerId) query.set("learnerId", learnerId);
  const suffix = query.size ? `?${query}` : "";
  const {
    courses,
    openCount: openHelpCount,
    needsReplyCount = 0,
    learner,
    threads,
  } = await serverApiFetch<MentorHelpInboxView>(
    `/api/v1/teach/help/threads${suffix}`,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {copy.mentorTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.mentorSubtitle}
          </p>
          {(statusFilter ?? "open") !== "resolved" && (
            <p className="mt-2 text-sm font-medium text-foreground">
              {needsReplyCount > 0
                ? `${needsReplyCount} ${needsReplyCount === 1 ? "needs" : "need"} your reply. ${Math.max(0, threads.length - needsReplyCount)} waiting on the learner.`
                : threads.length > 0
                  ? "Nothing needs your reply. These are waiting on the learner: mark them resolved when you are done."
                  : ""}
            </p>
          )}
          {learner ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Showing only {learner.label}.{" "}
              <Link href="/help" className="font-medium text-primary hover:underline">
                Show everyone
              </Link>
            </p>
          ) : null}
        </div>

        <form
          className="flex flex-wrap items-center gap-2"
          action="/help"
          method="GET"
        >
          <AutoSubmitSelect
            name="status"
            defaultValue={statusFilter ?? "open"}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
          >
            <option value="open">Open ({openHelpCount})</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </AutoSubmitSelect>
          <AutoSubmitSelect
            name="kind"
            defaultValue={kindFilter ?? "all"}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
          >
            <option value="all">Everything</option>
            <option value="questions">Questions</option>
            <option value="reports">Lesson reports</option>
          </AutoSubmitSelect>
          {courses.length > 1 && (
            <AutoSubmitSelect
              name="courseId"
              defaultValue={courseFilter ?? ""}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </AutoSubmitSelect>
          )}
        </form>
      </div>

      {threads.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Inbox className="size-8" aria-hidden />
          </span>
          <p className="text-base font-semibold text-foreground">
            {statusFilter === "resolved"
              ? copy.mentorEmptyResolved
              : copy.mentorEmptyOpen}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {copy.mentorEmpty}
          </p>
        </div>
      ) : (
        <HelpInboxList threads={threads} />
      )}
    </div>
  );
}
