"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import { ENROLLMENT_LABEL, errorText, percentLabel } from "@/lib/classes";
import { LocalDate } from "@/components/classes/local-date";
import type { ClassEnrollmentState, TeachClassDetail } from "@/shared/api/classes";

function stateText(state: ClassEnrollmentState, percent: number): string {
  return state === "active" ? `Active, ${percentLabel(percent)}` : ENROLLMENT_LABEL[state];
}

export function RosterPanel({ detail }: { detail: TeachClassDetail }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async (userId: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<void>(`/api/v1/teach/classes/${encodeURIComponent(detail.id)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
      setConfirming(null);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (detail.members.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
        <h2 className="text-base font-semibold">No learners yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Share the join link at the top of this page. Learners appear here when they join.</p>
      </div>
    );
  }

  return (
    <section aria-label="Learners" className="space-y-3">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <ul className="space-y-3">
        {detail.members.map((member) => (
          <li key={member.userId} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{member.name}</p>
                {member.email ? <p className="truncate text-sm text-muted-foreground">{member.email}</p> : null}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Joined <LocalDate iso={member.joinedAt} />
                </p>
              </div>
              {confirming === member.userId ? null : (
                <Button type="button" variant="outline" size="xs" onClick={() => setConfirming(member.userId)}>
                  Remove
                </Button>
              )}
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {detail.courses.map((course) => {
                const progress = member.courses.find((c) => c.courseId === course.id);
                const state = progress?.state ?? "not-enrolled";
                return (
                  <li key={course.id} className="flex max-w-full items-center gap-2 text-sm">
                    <span className="truncate text-muted-foreground">{course.title}</span>
                    <Badge variant={state === "payment-required" ? "destructive" : state === "completed" ? "default" : "secondary"}>
                      {stateText(state, progress?.percentComplete ?? 0)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
            {confirming === member.userId ? (
              <div role="alertdialog" aria-label={`Remove ${member.name}`} className="mt-3 flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">Remove {member.name} from this class? They keep their course progress and can join again with the link.</p>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="destructive" size="xs" loading={busy} disabled={busy} onClick={() => void remove(member.userId)}>
                    Yes, remove
                  </Button>
                  <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={() => setConfirming(null)}>
                    Keep
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
