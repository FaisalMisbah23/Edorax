import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { HelpThreadDetail } from "@/shared/api/help";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetch, serverApiFetchOrNotFound } from "@/lib/api-server";
import type { ThreadFeedbackView } from "@/shared/api/teach";
import { HelpAiPanel } from "@/components/teach/help-ai-panel";
import { HelpThreadDetail as HelpThreadDetailPanel } from "@/components/help/help-thread-detail";
import { helpUiCopy as copy } from "@/shared/lib/help-ui-copy";

export default async function MentorHelpThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await requireTeachSurface();
  // The shared thread endpoint answers 403 unless the caller mentors the course.
  const thread = await serverApiFetchOrNotFound<HelpThreadDetail>(
    `/api/v1/help/threads/${encodeURIComponent(threadId)}`,
  );
  const menteeName = thread.mentee.name ?? thread.mentee.email ?? "Learner";
  const feedback = await serverApiFetch<ThreadFeedbackView>(`/api/v1/teach/help/threads/${encodeURIComponent(threadId)}/feedback`).catch(
    (): ThreadFeedbackView => ({ scope: null, note: null })
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/help"
        className="group inline-flex items-center gap-1.5 rounded-full py-1 pr-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft
          className="size-4 transition-transform group-hover:-translate-x-0.5"
          aria-hidden
        />
        {copy.mentorNav}
      </Link>

      {thread.kind === "LESSON_REPORT" && (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
            Lesson report{thread.category ? ` · ${thread.category.toLowerCase().replace("_", " ")}` : ""}
          </p>
          {thread.quote && (
            <p className="mt-1 text-sm italic text-muted-foreground">
              &ldquo;{thread.quote}&rdquo;
            </p>
          )}
        </div>
      )}

      <div className="mt-4 rounded-2xl border bg-card px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Asked in</p>
        <p className="mt-1 text-sm font-medium text-foreground">{thread.course.title}</p>
        <p className="text-sm text-muted-foreground">{thread.chapter?.title ?? "General course question, no chapter"}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {thread.chapterId ? (
            <Link
              href={`/courses/${encodeURIComponent(thread.course.slug)}/preview?chapter=${encodeURIComponent(thread.chapterId)}`}
              className="inline-flex h-8 items-center rounded-full border bg-background px-3 font-medium text-foreground hover:bg-muted/50"
            >
              Open chapter
            </Link>
          ) : null}
          <Link href={`/learners`} className="inline-flex h-8 items-center rounded-full border bg-background px-3 font-medium text-foreground hover:bg-muted/50">
            All learners
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <HelpAiPanel threadId={thread.id} canDraft={thread.status === "OPEN"} initialFeedback={feedback} />
      </div>

      <div className="mt-4">
        <HelpThreadDetailPanel
          variant="mentor"
          layout="page"
          threadId={thread.id}
          status={thread.status}
          messages={thread.messages}
          viewerId={user.id}
          header={{
            menteeName,
            subtitle: `${thread.chapter?.title ?? "Course question"} · ${thread.course.title}`,
          }}
          aside={{
            menteeId: thread.menteeId,
            menteeEmail: thread.mentee.email,
            courseTitle: thread.course.title,
            lessonTitle: thread.chapter?.title ?? null,
          }}
        />
      </div>
    </div>
  );
}
