import Link from "next/link";
import { Inbox } from "lucide-react";
import type { FeedbackItem, FeedbackView } from "@/shared/api/teach";
import { requireTeachSurface } from "@/server/auth/guards";
import { serverApiFetch } from "@/lib/api-server";
import { CopyFeedbackButton } from "@/components/teach/copy-feedback-button";

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

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  await requireTeachSurface();
  const { scope } = await searchParams;
  const view = await serverApiFetch<FeedbackView>("/api/v1/teach/feedback");
  const filter = scope === "course" ? "COURSE" : scope === "platform" ? "PLATFORM" : null;
  const items = filter ? view.items.filter((item) => item.scope === filter) : view.items;
  const tabs = [
    { label: `All (${view.items.length})`, href: "/feedback", active: !filter },
    { label: `Course (${view.counts.course})`, href: "/feedback?scope=course", active: filter === "COURSE" },
    { label: `Platform (${view.counts.platform})`, href: "/feedback?scope=platform", active: filter === "PLATFORM" },
  ];

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

      <nav aria-label="Feedback type" className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium ${
              tab.active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted/50"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-2 text-center">
          <Inbox className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">No feedback yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Open a learner question and choose Course problem or Platform problem to add it here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="block rounded-xl border bg-card p-4 hover:bg-muted/30">
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
                    {item.category ? ` · ${item.category.toLowerCase().replace("_", " ")}` : ""} · {item.status === "OPEN" ? "open" : "resolved"}
                  </span>
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">{where(item)}</p>
                {item.note ? <p className="mt-1 text-sm text-foreground">{item.note}</p> : null}
                {item.quote ? <p className="mt-1 text-sm italic text-muted-foreground">&ldquo;{item.quote}&rdquo;</p> : null}
                {item.message ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.learnerLabel} · {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
