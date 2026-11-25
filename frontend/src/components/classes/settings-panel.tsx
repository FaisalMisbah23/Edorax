"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { errorText, fromLocalInput, toLocalInput } from "@/lib/classes";
import { CoursePicker } from "@/components/classes/course-picker";
import type { ClassCourseRef, ClassSummary, TeachClassDetail } from "@/shared/api/classes";

export function SettingsPanel({ detail, options }: { detail: TeachClassDetail; options: ClassCourseRef[] }) {
  const router = useRouter();
  const [name, setName] = useState(detail.name);
  const [courseIds, setCourseIds] = useState(detail.courses.map((c) => c.id));
  const [startsAt, setStartsAt] = useState(toLocalInput(detail.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(detail.endsAt));
  const [busy, setBusy] = useState<"save" | "code" | "archive" | null>(null);
  const [confirmCode, setConfirmCode] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Courses already in the class stay pickable even if they are no longer in the publish list.
  const known = new Set(options.map((o) => o.id));
  const allOptions = [...options, ...detail.courses.filter((c) => !known.has(c.id))];
  const base = `/api/v1/teach/classes/${encodeURIComponent(detail.id)}`;

  const run = async (kind: "save" | "code" | "archive", work: () => Promise<string>) => {
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      setMessage(await work());
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
      setConfirmCode(false);
      setConfirmArchive(false);
    }
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError("Give the class a name.");
    if (courseIds.length === 0) return setError("Pick at least one course.");
    const start = fromLocalInput(startsAt);
    const end = fromLocalInput(endsAt);
    if (start && end && end <= start) return setError("The end date must be after the start date.");
    void run("save", async () => {
      await apiFetch<ClassSummary>(base, { method: "PATCH", json: { name: name.trim(), courseIds, startsAt: start, endsAt: end } });
      return "Saved.";
    });
  };

  return (
    <section aria-label="Settings" className="space-y-8">
      <form onSubmit={save} className="space-y-5 rounded-lg border border-border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="settings-name">Class name</Label>
          <Input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label>Courses</Label>
          <CoursePicker options={allOptions} selected={courseIds} onChange={setCourseIds} idPrefix="settings" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-start">Start</Label>
            <Input id="settings-start" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-end">End</Label>
            <Input id="settings-end" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </div>
        </div>
        <Button type="submit" loading={busy === "save"} disabled={busy !== null}>
          Save changes
        </Button>
      </form>

      <div className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold">Join code</h2>
        <p className="text-sm text-muted-foreground">A new join code makes a new link. The old link stops working right away. Learners already in the class stay in it.</p>
        {confirmCode ? (
          <div role="alertdialog" aria-label="New join code" className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">Make a new join code and stop the old link from working?</p>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="destructive"
                size="xs"
                loading={busy === "code"}
                disabled={busy !== null}
                onClick={() =>
                  void run("code", async () => {
                    await apiFetch<ClassSummary>(`${base}/rotate-code`, { method: "POST" });
                    return "The new join code is at the top of this page.";
                  })
                }
              >
                Yes, make a new code
              </Button>
              <Button type="button" variant="ghost" size="xs" disabled={busy !== null} onClick={() => setConfirmCode(false)}>
                Keep the old one
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => setConfirmCode(true)}>
            New join code
          </Button>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold">{detail.archived ? "Reopen this class" : "Archive this class"}</h2>
        <p className="text-sm text-muted-foreground">
          {detail.archived
            ? "Reopening lets new learners join with the link again."
            : "An archived class stops taking new learners. Everything already in it stays, and you can reopen it any time."}
        </p>
        {confirmArchive && !detail.archived ? (
          <div role="alertdialog" aria-label="Archive class" className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">Archive this class?</p>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="destructive"
                size="xs"
                loading={busy === "archive"}
                disabled={busy !== null}
                onClick={() =>
                  void run("archive", async () => {
                    await apiFetch<ClassSummary>(base, { method: "PATCH", json: { archived: true } });
                    return "Archived.";
                  })
                }
              >
                Yes, archive
              </Button>
              <Button type="button" variant="ghost" size="xs" disabled={busy !== null} onClick={() => setConfirmArchive(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={busy === "archive"}
            disabled={busy !== null}
            onClick={() =>
              detail.archived
                ? void run("archive", async () => {
                    await apiFetch<ClassSummary>(base, { method: "PATCH", json: { archived: false } });
                    return "Reopened.";
                  })
                : setConfirmArchive(true)
            }
          >
            {detail.archived ? "Reopen class" : "Archive class"}
          </Button>
        )}
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}
