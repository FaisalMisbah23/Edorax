import Link from "next/link";
import { Inbox } from "lucide-react";
import type { FeedbackItem, FeedbackView } from "@/shared/api/teach";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetch } from "@/lib/api-server";
import { CopyFeedbackButton } from "@/components/teach/copy-feedback-button";
import { FeedbackResolveButton } from "@/components/teach/feedback-resolve-button";
import { ThreadLinks } from "@/components/teach/thread-links";

// Feedback for the team: lesson reports learners filed, and questions a mentor flagged
// as a problem with a course or with the platform. One list to hand over for fixing.

function where(item: FeedbackItem): string {
  return [item.courseTitle, item.moduleTitle, item.chapterTitle].filter(Boolean).join(" › ");
}

function asText(items: FeedbackItem[]): string {
  return items
    .map((item, index) =>
      [
        `${index + 1}. [${item.scope === "PLATFORM" ? "Platform" : "Course"}] ${where(item)}`,
        `   From: ${item.learnerLabel} on ${new Date(item.createdAt).toISOString().slice(0, 10)} (${item.status === "OPEN" ? "open" : "resolved"})`,
        item.note ? `   Note: ${item.note}` : null,
        item.quote ? `   Quoted passage: ${item.quote}` : null,
        item.message ? `   Learner said: ${item.message}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ scope?: string; status?: string }> }) {
  await requireTeachSurface();
  const { scope, status } = await searchParams;
  const view = await serverApiFetch<FeedbackView>("/api/v1/teach/feedback");
  const filter = scope === "course" ? "COURSE" : scope === "platform" ? "PLATFORM" : null;
  const statusFilter = status === "resolved" ? "RESOLVED" : status === "all" ? null : "OPEN";
  const scoped = filter ? view.items.filter((item) => item.scope === filter) : view.items;
  const items = statusFilter ? scoped.filter((item) => item.status === statusFilter) : scoped;
  const openCount = scoped.filter((item) => item.status === "OPEN").length;
  const resolvedCount = scoped.length - openCount;
  const hrefFor = (nextScope: string | null, nextStatus: string | null) => {
    const params = new URLSearchParams();
    if (nextScope) params.set("scope", nextScope);
    if (nextStatus) params.set("status", nextStatus);
    return params.size ? `/feedback?${params}` : "/feedback";
  };
  const currentScope = filter === "COURSE" ? "course" : filter === "PLATFORM" ? "platform" : null;
  const currentStatus = statusFilter === "RESOLVED" ? "resolved" : statusFilter === null ? "all" : null;
  const scopeTabs = [
    { label: `All types (${view.items.length})`, href: hrefFor(null, currentStatus), active: !filter },
    { label: `Course (${view.counts.course})`, href: hrefFor("course", currentStatus), active: filter === "COURSE" },
    { label: `Platform (${view.counts.platform})`, href: hrefFor("platform", currentStatus), active: filter === "PLATFORM" },
  ];
  const statusTabs = [
    { label: `Open (${openCount})`, href: hrefFor(currentScope, null), active: statusFilter === "OPEN" },
    { label: `Resolved (${resolvedCount})`, href: hrefFor(currentScope, "resolved"), active: statusFilter === "RESOLVED" },
    { label: `Both (${scoped.length})`, href: hrefFor(currentScope, "all"), active: statusFilter === null },
  ];
  const tabClass = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium sm:h-9 sm:min-h-0 ${
      active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted/50"
    }`;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Feedback</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Problems learners raised about a course or the platform. Flag a learner question to add it here.
          </p>
        </div>
        {items.length ? <CopyFeedbackButton text={asText(items)} /> : null}
      </div>

      <nav aria-label="Feedback status" className="mt-4 flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <Link key={tab.label} href={tab.href} aria-current={tab.active ? "page" : undefined} className={tabClass(tab.active)}>
            {tab.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Feedback type" className="mt-2 flex flex-wrap gap-2">
        {scopeTabs.map((tab) => (
          <Link key={tab.label} href={tab.href} aria-current={tab.active ? "page" : undefined} className={tabClass(tab.active)}>
            {tab.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-2 text-center">
          <Inbox className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">
            {statusFilter === "OPEN" && scoped.length > 0 ? "Nothing open" : statusFilter === "RESOLVED" ? "Nothing resolved yet" : "No feedback yet"}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {statusFilter === "OPEN" && scoped.length > 0
              ? "Every piece of feedback here is resolved. Choose Resolved to read them again."
              : "Open a learner question and choose Course problem or Platform problem to add it here."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border bg-card p-4 text-card-foreground">
              <p className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2.5 py-0.5 font-semibold uppercase tracking-wide ${
                    item.scope === "PLATFORM" ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {item.scope === "PLATFORM" ? "Platform" : "Course"}
                </span>
                <span className="text-muted-foreground">
                  {item.source === "report" ? "Lesson report" : "Flagged question"}
                  {item.category ? ` · ${item.category.toLowerCase().replace("_", " ")}` : ""}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-semibold ${
                    item.status === "OPEN" ? "bg-amber-500/15 text-amber-800 dark:text-amber-200" : "bg-ok-soft text-ok"
                  }`}
                >
                  {item.status === "OPEN" ? "Open" : "Resolved"}
                </span>
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{where(item)}</p>
              {item.note ? <p className="mt-1 text-sm text-foreground">{item.note}</p> : null}
              {item.quote ? <p className="mt-1 text-sm italic text-muted-foreground">&ldquo;{item.quote}&rdquo;</p> : null}
              {item.message ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p> : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {item.learnerLabel} &middot; {new Date(item.createdAt).toLocaleDateString()}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 sm:min-h-8 sm:px-3"
                >
                  Open conversation
                </Link>
                <FeedbackResolveButton threadId={item.id} status={item.status} />
              </div>
              <ThreadLinks links={item} learnerLabel={item.learnerLabel} className="mt-2" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
