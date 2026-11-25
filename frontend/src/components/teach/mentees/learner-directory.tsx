"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BellRing, ChevronDown, CircleHelp, Mail, MessageSquareText, Search } from "lucide-react";
import type { MenteeRosterItem } from "@/shared/api/teach";
import { nudgeManyAction, nudgeMenteeAction } from "@/server/actions/nudge-mentee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// The instructor's working list of people. One row per learner, with what they need from
// you and the buttons to do it (check answers, answer questions, nudge, email) on the row.
// Opening a row shows each course. Filters and sort answer "who do I look at first?".

const NUDGE_QUIET_MS = 24 * 60 * 60 * 1000;

type Segment = "all" | "waiting" | "inactive" | "notStarted" | "active" | "completed";
type SortKey = "attention" | "recent" | "progress" | "name";

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
  current: MenteeRosterItem;
  inactive: MenteeRosterItem[];
  state: Exclude<Segment, "all">;
};

function nudgedRecently(item: MenteeRosterItem, now: number) {
  return item.lastNudgedAt != null && now - new Date(item.lastNudgedAt).getTime() < NUDGE_QUIET_MS;
}

function groupByPerson(mentees: MenteeRosterItem[]): Person[] {
  const byUser = new Map<string, MenteeRosterItem[]>();
  for (const mentee of mentees) {
    const list = byUser.get(mentee.userId);
    if (list) list.push(mentee);
    else byUser.set(mentee.userId, [mentee]);
  }
  return [...byUser.entries()].map(([userId, enrollments]) => {
    const latest = [...enrollments].sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""))[0]!;
    const pendingReviews = enrollments.reduce((sum, item) => sum + item.pendingReviews, 0);
    const openHelpRequests = enrollments.reduce((sum, item) => sum + item.openHelpRequests, 0);
    const inactive = enrollments.filter((item) => item.activityState === "inactive" && item.status === "IN_PROGRESS");
    const state: Person["state"] =
      pendingReviews + openHelpRequests > 0
        ? "waiting"
        : enrollments.every((item) => item.progressState === "completed")
          ? "completed"
          : enrollments.every((item) => item.progressState === "not-started")
            ? "notStarted"
            : enrollments.some((item) => item.activityState === "recent")
              ? "active"
              : "inactive";
    return {
      userId,
      name: latest.name,
      email: latest.email,
      enrollments,
      averagePercent: Math.round(enrollments.reduce((sum, item) => sum + item.percentComplete, 0) / enrollments.length),
      pendingReviews,
      openHelpRequests,
      lastActiveAt: latest.lastActiveAt,
      lastActiveLabel: latest.lastActiveLabel,
      current: latest,
      inactive,
      state,
    };
  });
}

const STATE_LABEL: Record<Person["state"], { label: string; className: string }> = {
  waiting: { label: "Waiting on you", className: "bg-amber-500/15 text-amber-800 dark:text-amber-200" },
  inactive: { label: "Gone quiet", className: "bg-destructive/10 text-destructive" },
  notStarted: { label: "Not started", className: "bg-muted text-muted-foreground" },
  active: { label: "Active", className: "bg-ok-soft text-ok" },
  completed: { label: "Completed", className: "bg-primary/10 text-primary" },
};

const SORT_RANK: Record<Person["state"], number> = { waiting: 0, inactive: 1, notStarted: 2, active: 3, completed: 4 };

function Bar({ percent }: { percent: number }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </span>
  );
}

function NudgeButton({ item, label, now, onDone }: { item: MenteeRosterItem; label: string; now: number; onDone: (message: string) => void }) {
  const router = useRouter();
  const [sentNow, setSentNow] = useState(false);
  const [pending, startTransition] = useTransition();
  const recently = sentNow || nudgedRecently(item, now);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending || recently || !item.email}
      title={recently ? "Already nudged in the last day" : `Email a reminder about ${item.course?.title ?? "this course"}`}
      onClick={() =>
        startTransition(async () => {
          const result = await nudgeMenteeAction({ enrollmentId: item.id });
          if (!result.ok) onDone(result.error);
          else {
            setSentNow(true);
            onDone(`Nudge emailed to ${item.name}.`);
            router.refresh();
          }
        })
      }
    >
      <BellRing aria-hidden /> {recently ? "Nudged" : label}
    </Button>
  );
}

export function LearnerDirectory({ mentees, now }: { mentees: MenteeRosterItem[]; now: number }) {
  const router = useRouter();
  const people = useMemo(() => groupByPerson(mentees), [mentees]);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [sort, setSort] = useState<SortKey>("attention");
  const [openAll, setOpenAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const result: Record<Segment, number> = { all: people.length, waiting: 0, inactive: 0, notStarted: 0, active: 0, completed: 0 };
    for (const person of people) result[person.state] += 1;
    return result;
  }, [people]);

  const needle = query.trim().toLowerCase();
  const visible = people
    .filter((person) => segment === "all" || person.state === segment)
    .filter(
      (person) =>
        !needle ||
        person.name.toLowerCase().includes(needle) ||
        (person.email ?? "").toLowerCase().includes(needle) ||
        person.enrollments.some((item) => item.course?.title.toLowerCase().includes(needle))
    )
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "progress") return a.averagePercent - b.averagePercent;
      if (sort === "recent") return (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "");
      return SORT_RANK[a.state] - SORT_RANK[b.state] || (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "");
    });

  // Everyone on screen who has gone quiet on a course and was not nudged in the last day.
  const bulkTargets = visible.flatMap((person) => person.inactive.filter((item) => item.email && !nudgedRecently(item, now)));

  function nudgeAll() {
    startTransition(async () => {
      const result = await nudgeManyAction({ enrollmentIds: bulkTargets.map((item) => item.id) });
      setConfirmBulk(false);
      setNotice(
        result.ok
          ? `Nudged ${result.sent}.${result.skipped ? ` ${result.skipped} were nudged in the last day and skipped.` : ""}${result.failed ? ` ${result.failed} failed.` : ""}`
          : result.error
      );
      router.refresh();
    });
  }

  function toggle(userId: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const segments: Array<{ key: Segment; label: string }> = [
    { key: "all", label: "All" },
    { key: "waiting", label: "Waiting on you" },
    { key: "inactive", label: "Gone quiet" },
    { key: "notStarted", label: "Not started" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <section aria-label="Learners" className="space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter learners">
        {segments.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={segment === item.key}
            onClick={() => setSegment(item.key)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
              segment === item.key ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted/50"
            )}
          >
            {item.label} <span className={cn("text-xs", segment === item.key ? "opacity-80" : "text-muted-foreground")}>{counts[item.key]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Search learners</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email or course" className="h-10 pl-9 text-base" />
        </label>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="h-10 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-ring"
            >
              <option value="attention">Needs you first</option>
              <option value="recent">Last active</option>
              <option value="progress">Least progress</option>
              <option value="name">Name</option>
            </select>
          </label>
          <button type="button" onClick={() => setOpenAll((value) => !value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-medium text-foreground">
            {openAll ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </div>

      {bulkTargets.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {confirmBulk ? (
            <>
              <p className="text-sm text-foreground">
                Email a reminder to {bulkTargets.length} {bulkTargets.length === 1 ? "enrollment" : "enrollments"} that went quiet for 7 or more days? Each learner gets one email per course.
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={nudgeAll} disabled={pending} loading={pending}>
                  <BellRing aria-hidden /> Yes, nudge {bulkTargets.length}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setConfirmBulk(false)} disabled={pending}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{bulkTargets.length} in this list went quiet for 7 or more days and were not nudged today.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => setConfirmBulk(true)}>
                <BellRing aria-hidden /> Nudge all {bulkTargets.length}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-foreground">
          {notice}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {visible.length} of {people.length} learners
      </p>

      <ul className="space-y-2">
        {visible.map((person) => {
          const isOpen = openAll || open.has(person.userId);
          const state = STATE_LABEL[person.state];
          const nudgeTarget = person.inactive[0] ?? person.current;
          return (
            <li key={person.userId} className={cn("overflow-hidden rounded-xl border bg-card", person.state === "waiting" && "border-amber-400/60")}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary" aria-hidden>
                    {person.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/learners/${encodeURIComponent(person.userId)}`} className="truncate text-sm font-semibold text-foreground hover:underline">
                        {person.name}
                      </Link>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", state.className)}>{state.label}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{person.email ?? "No email"}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {person.enrollments.length} {person.enrollments.length === 1 ? "course" : "courses"} · {person.averagePercent}% average · {person.lastActiveLabel}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {person.current.currentChapter ? `Now on: ${person.current.currentChapter}` : "Has not opened a chapter yet"}
                      {person.current.course ? ` (${person.current.course.title})` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={isOpen ? `Hide ${person.name}'s courses` : `Show ${person.name}'s courses`}
                    onClick={() => toggle(person.userId)}
                    className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {person.pendingReviews > 0 ? (
                    <Link href={`/review?learnerId=${encodeURIComponent(person.userId)}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                      <MessageSquareText className="size-4" aria-hidden /> Check {person.pendingReviews} {person.pendingReviews === 1 ? "answer" : "answers"}
                    </Link>
                  ) : null}
                  {person.openHelpRequests > 0 ? (
                    <Link href={`/help?learnerId=${encodeURIComponent(person.userId)}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                      <CircleHelp className="size-4" aria-hidden /> Answer {person.openHelpRequests} {person.openHelpRequests === 1 ? "question" : "questions"}
                    </Link>
                  ) : null}
                  <NudgeButton item={nudgeTarget} label="Nudge" now={now} onDone={setNotice} />
                  {person.email ? (
                    <a href={`mailto:${person.email}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted/50">
                      <Mail className="size-4" aria-hidden /> Email
                    </a>
                  ) : null}
                  <Link href={`/learners/${encodeURIComponent(person.userId)}`} className="inline-flex h-8 items-center gap-1 rounded-lg border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted/50">
                    All their courses <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </div>

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
                      <div className="w-full sm:w-40">
                        <p className="mb-1 text-xs text-muted-foreground">
                          {Math.round(item.percentComplete)}% · {item.chaptersCompleted}/{item.chapterCount} chapters
                        </p>
                        <Bar percent={item.percentComplete} />
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <NudgeButton item={item} label="Nudge" now={now} onDone={setNotice} />
                        <Link href={item.evaluationHref} className="inline-flex h-8 items-center gap-1 rounded-lg border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted/50">
                          Open <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      </div>
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
