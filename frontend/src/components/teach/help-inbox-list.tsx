"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import type { MentorHelpInboxThread } from "@/shared/api/teach";
import { resolveHelpThreads } from "@/server/actions/help-ai";
import { Button } from "@/components/ui/button";
import { HelpInboxThreadCard } from "@/components/teach/help-inbox-thread-card";
import { cn } from "@/lib/utils";

// The question list with a selection bar: tick the threads you are done with and resolve
// them together, or resolve every thread you have already answered in one go.

export function HelpInboxList({ threads }: { threads: MentorHelpInboxThread[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | { ids: string[]; label: string }>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Chat view: names on the left, the picked conversation on the right. Phones always get the list.
  const [view, setView] = useState<"chat" | "list">("chat");
  const [activeId, setActiveId] = useState<string | null>(threads[0]?.id ?? null);
  const active = threads.find((thread) => thread.id === activeId) ?? threads[0] ?? null;

  const open = threads.filter((thread) => thread.status === "OPEN");
  const answered = open.filter((thread) => !thread.needsReply);
  const chosen = open.filter((thread) => selected.has(thread.id));
  const allSelected = open.length > 0 && chosen.length === open.length;

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function resolve(ids: string[]) {
    startTransition(async () => {
      const result = await resolveHelpThreads({ threadIds: ids });
      setConfirm(null);
      setSelected(new Set());
      setNotice(result.failed ? `Resolved ${result.resolved}. ${result.failed} could not be resolved.` : `Resolved ${result.resolved}.`);
      router.refresh();
    });
  }

  return (
    <>
      {open.length > 0 ? (
        <div className="mt-6 rounded-xl border bg-card p-3">
          {confirm ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground">
                Mark {confirm.ids.length} {confirm.label} as resolved? Learners can still read the replies.
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => resolve(confirm.ids)} disabled={pending} loading={pending}>
                  <CheckCheck aria-hidden /> Yes, resolve {confirm.ids.length}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setConfirm(null)} disabled={pending}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => setSelected(event.target.checked ? new Set(open.map((thread) => thread.id)) : new Set())}
                  className="size-4 accent-[var(--primary)]"
                />
                Select all
              </label>
              <Button
                type="button"
                size="sm"
                disabled={chosen.length === 0}
                onClick={() => setConfirm({ ids: chosen.map((thread) => thread.id), label: chosen.length === 1 ? "selected question" : "selected questions" })}
              >
                <CheckCheck aria-hidden /> Resolve selected{chosen.length ? ` (${chosen.length})` : ""}
              </Button>
              {answered.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirm({ ids: answered.map((thread) => thread.id), label: answered.length === 1 ? "question you already answered" : "questions you already answered" })}
                >
                  Resolve all you answered ({answered.length})
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirm({ ids: open.map((thread) => thread.id), label: open.length === 1 ? "open question" : "open questions" })}
              >
                Resolve all ({open.length})
              </Button>
            </div>
          )}
          {notice ? (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              {notice}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 hidden justify-end gap-1 lg:flex" role="group" aria-label="Layout">
        {(["chat", "list"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            onClick={() => setView(option)}
            className={cn(
              "h-8 rounded-lg border px-3 text-xs font-medium",
              view === option ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted/50"
            )}
          >
            {option === "chat" ? "Chat view" : "List view"}
          </button>
        ))}
      </div>

      {view === "chat" && active ? (
        <div className="mt-3 hidden gap-4 lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
          <ul className="max-h-[70dvh] space-y-1 overflow-y-auto rounded-2xl border bg-card p-2" aria-label="Conversations">
            {threads.map((thread) => {
              const last = thread.messages?.[thread.messages.length - 1] ?? null;
              const isOpen = thread.status === "OPEN";
              return (
                <li key={thread.id} className={cn("flex items-start gap-2 rounded-xl p-2", thread.id === active.id ? "bg-primary/10" : "hover:bg-muted/50")}>
                  {isOpen ? (
                    <input
                      type="checkbox"
                      checked={selected.has(thread.id)}
                      onChange={(event) => toggle(thread.id, event.target.checked)}
                      aria-label={`Select ${thread.menteeLabel}'s question`}
                      className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                    />
                  ) : null}
                  <button type="button" onClick={() => setActiveId(thread.id)} aria-current={thread.id === active.id} className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn("size-2 shrink-0 rounded-full", !isOpen ? "bg-ok" : thread.needsReply ? "bg-amber-500" : "bg-muted-foreground/40")}
                        title={!isOpen ? "Resolved" : thread.needsReply ? "Needs your reply" : "Waiting on learner"}
                      />
                      <span className="truncate text-sm font-semibold text-foreground">{thread.menteeLabel}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {thread.courseTitle}
                      {thread.chapterTitle ? ` › ${thread.chapterTitle}` : ""}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {last ? `${last.fromLearner ? "" : "You: "}${last.body}` : (thread.preview?.body ?? "")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <ul>
            <HelpInboxThreadCard
              key={active.id}
              thread={active}
              selected={selected.has(active.id)}
              onSelect={active.status === "OPEN" ? (on) => toggle(active.id, on) : undefined}
            />
          </ul>
        </div>
      ) : null}

      <ul className={cn("mt-3 space-y-3", view === "chat" && "lg:hidden")}>
        {threads.map((thread) => (
          <HelpInboxThreadCard
            key={thread.id}
            thread={thread}
            selected={selected.has(thread.id)}
            onSelect={thread.status === "OPEN" ? (on) => toggle(thread.id, on) : undefined}
          />
        ))}
      </ul>
    </>
  );
}
