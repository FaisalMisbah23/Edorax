import Link from "next/link";
import { ThumbsUp } from "lucide-react";
import type { AdminModuleVersionFeedbackView } from "@/shared/api/module-versions";
import { requireRole } from "@/server/auth/guards";
import { serverApiFetch } from "@/lib/api-server";
import { AdminEmptyState, AdminPageHeader, AdminPanel, AdminSection } from "@/components/admin/admin-ui";
import { CopyFeedbackButton } from "@/components/teach/copy-feedback-button";
import { cn } from "@/lib/utils";
import {
  feedbackAsText,
  feedbackCourses,
  filterByCourse,
  groupVoteTotals,
  noteDate,
} from "@/lib/agent-ip-feedback";

// Learners' votes on which version of a module was better, with their notes. This is feedback
// for the course factory (agent-ip): which way of writing a module works for learners.

export default async function AgentIpFeedbackPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  await requireRole("ADMIN");
  const { course } = await searchParams;
  const all = await serverApiFetch<AdminModuleVersionFeedbackView>("/api/v1/admin/module-version-feedback");
  const courses = feedbackCourses(all);
  const picked = courses.find((item) => item.slug === course)?.slug ?? null;
  const view = filterByCourse(all, picked);
  const groups = groupVoteTotals(view.totals);
  const empty = groups.length === 0 && view.notes.length === 0;
  const tabs = [
    { label: "All courses", href: "/admin/agent-ip-feedback", active: !picked },
    ...courses.map((item) => ({
      label: item.title,
      href: `/admin/agent-ip-feedback?course=${encodeURIComponent(item.slug)}`,
      active: picked === item.slug,
    })),
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        eyebrow="Courses"
        title="Agent IP feedback"
        description="Some modules come in more than one version. Learners can vote for the version they found better and add a note. Use this to decide which way of writing a module works."
        actions={empty ? null : <CopyFeedbackButton text={feedbackAsText(view)} label="Copy as text" />}
      />

      {courses.length > 0 ? (
        <nav aria-label="Filter by course" className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 max-w-full items-center truncate rounded-full border px-3.5 text-sm font-medium",
                tab.active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted/50"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {empty ? (
        <AdminEmptyState
          title="No votes yet"
          description="When a learner reads a module that has more than one version, they can vote for the better one. Their votes and notes will show up here."
        />
      ) : (
        <>
          <AdminSection title="Votes per version" description="How many learners prefer each version of a module." className="mt-0">
            <ul className="grid gap-3 md:grid-cols-2">
              {groups.map((group) => (
                <li key={`${group.courseSlug}/${group.moduleKey}`}>
                  <AdminPanel className="h-full">
                    <p className="text-xs text-muted-foreground">{group.courseTitle}</p>
                    <p className="mt-0.5 break-words text-sm font-semibold text-foreground">{group.moduleTitle}</p>
                    <ul className="mt-3 space-y-2.5">
                      {group.versions.map((version) => {
                        const share = group.totalVotes ? Math.round((version.votes / group.totalVotes) * 100) : 0;
                        return (
                          <li key={version.versionKey}>
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="min-w-0 break-words text-foreground">{version.versionLabel}</span>
                              <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                                {version.votes} {version.votes === 1 ? "vote" : "votes"}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden>
                              <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </AdminPanel>
                </li>
              ))}
            </ul>
          </AdminSection>

          <AdminSection title="Notes" description="What learners wrote with their vote, newest first.">
            {view.notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet. Learners voted without writing anything.</p>
            ) : (
              <ul className="space-y-3">
                {view.notes.map((note) => (
                  <li key={note.id}>
                    <AdminPanel>
                      <p className="break-words text-xs text-muted-foreground">
                        {note.courseTitle} &gt; {note.moduleTitle}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                        <ThumbsUp className="size-4 text-primary" aria-hidden />
                        <span className="break-words">{note.versionLabel}</span>
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">{note.note}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {note.learnerName} · {noteDate(note)}
                      </p>
                    </AdminPanel>
                  </li>
                ))}
              </ul>
            )}
          </AdminSection>
        </>
      )}
    </div>
  );
}
