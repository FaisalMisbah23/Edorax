"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Search } from "lucide-react";
import type { MenteeRosterItem } from "@/shared/api/teach";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// One row per person. A learner enrolled in several courses appears once, and
// opening the row shows their progress in each course.

type Person = {
  userId: string;
  name: string;
  email: string | null;
  enrollments: MenteeRosterItem[];
  averagePercent: number;
  pendingReviews: number;
  openHelpRequests: number;
  lastActiveAt: string | null;
  lastActiveLabel: string;
  needsAttention: boolean;
};

function groupByPerson(mentees: MenteeRosterItem[]): Person[] {
  const byUser = new Map<string, MenteeRosterItem[]>();
  for (const mentee of mentees) {
    const list = byUser.get(mentee.userId);
    if (list) list.push(mentee);
    else byUser.set(mentee.userId, [mentee]);
  }
  return [...byUser.entries()].map(([userId, enrollments]) => {
    const latest = [...enrollments].sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""))[0]!;
    return {
      userId,
      name: latest.name,
      email: latest.email,
      enrollments,
      averagePercent: Math.round(enrollments.reduce((sum, item) => sum + item.percentComplete, 0) / enrollments.length),
      pendingReviews: enrollments.reduce((sum, item) => sum + item.pendingReviews, 0),
      openHelpRequests: enrollments.reduce((sum, item) => sum + item.openHelpRequests, 0),
      lastActiveAt: latest.lastActiveAt,
      lastActiveLabel: latest.lastActiveLabel,
      needsAttention: enrollments.some((item) => item.attention.length > 0),
    };
  });
}

function Bar({ percent }: { percent: number }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </span>
  );
}

export function LearnerDirectory({ mentees }: { mentees: MenteeRosterItem[] }) {
  const people = useMemo(() => groupByPerson(mentees), [mentees]);
  const [query, setQuery] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [openAll, setOpenAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const needle = query.trim().toLowerCase();
  const visible = people.filter((person) => {
    if (onlyAttention && !person.needsAttention) return false;
    if (!needle) return true;
    return (
      person.name.toLowerCase().includes(needle) ||
      (person.email ?? "").toLowerCase().includes(needle) ||
      person.enrollments.some((item) => item.course?.title.toLowerCase().includes(needle))
    );
  });

  function toggle(userId: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  return (
    <section aria-label="Learners" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Search learners</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email or course" className="h-10 pl-9 text-base" />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={onlyAttention}
            onClick={() => setOnlyAttention((value) => !value)}
            className={cn("h-10 rounded-lg border px-3 text-sm font-medium", onlyAttention ? "border-primary bg-primary/10 text-primary" : "bg-background text-foreground")}
          >
            Needs attention
          </button>
          <button type="button" onClick={() => setOpenAll((value) => !value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-medium text-foreground">
            {openAll ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {visible.length} of {people.length} learners
      </p>

      <ul className="space-y-2">
        {visible.map((person) => {
          const isOpen = openAll || open.has(person.userId);
          return (
            <li key={person.userId} className="overflow-hidden rounded-xl border bg-card">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(person.userId)}
                className="flex w-full items-center gap-3 p-4 text-left outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary" aria-hidden>
                  {person.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{person.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{person.email ?? "No email"}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {person.enrollments.length} {person.enrollments.length === 1 ? "course" : "courses"} · {person.averagePercent}% average
                    </span>
                    <span>{person.lastActiveLabel}</span>
                    {person.pendingReviews > 0 ? <span className="font-medium text-amber-700 dark:text-amber-300">{person.pendingReviews} to check</span> : null}
                    {person.openHelpRequests > 0 ? <span className="font-medium text-amber-700 dark:text-amber-300">{person.openHelpRequests} open questions</span> : null}
                  </span>
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
              </button>

              {isOpen ? (
                <ul className="divide-y border-t bg-background/60">
                  {person.enrollments.map((item) => (
                    <li key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.course?.title ?? "Course"}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.currentChapter ? `Now on: ${item.currentChapter}` : "Not started"} · {item.lastActiveLabel}
                        </p>
                        {item.attention.length ? (
                          <p className="mt-1 flex flex-wrap gap-x-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                            {item.attention.map((flag) => (
                              <span key={flag.kind}>{flag.label}</span>
                            ))}
                          </p>
                        ) : null}
                      </div>
                      <div className="w-full sm:w-44">
                        <p className="mb-1 text-xs text-muted-foreground">
                          {Math.round(item.percentComplete)}% · {item.chaptersCompleted}/{item.chapterCount} chapters
                        </p>
                        <Bar percent={item.percentComplete} />
                      </div>
                      <Link
                        href={item.evaluationHref}
                        className="inline-flex h-9 shrink-0 items-center gap-1 self-start rounded-lg border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted/50 sm:self-center"
                      >
                        Open <ArrowRight className="size-3.5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      {visible.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No learners match.</p> : null}
    </section>
  );
}
