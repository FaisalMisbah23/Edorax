"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { errorText, fromLocalInput, toLocalInput } from "@/lib/classes";
import type { TeachClassDetail } from "@/shared/api/classes";

export function DueDatesPanel({ detail }: { detail: TeachClassDetail }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const course of detail.courses) for (const mod of course.modules) initial[mod.id] = toLocalInput(mod.dueAt);
    return initial;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const items = Object.entries(values).map(([moduleId, value]) => ({ moduleId, dueAt: fromLocalInput(value) }));
      await apiFetch(`/api/v1/teach/classes/${encodeURIComponent(detail.id)}/due-dates`, { method: "PUT", json: { items } });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const change = (id: string, value: string) => {
    setSaved(false);
    setValues((current) => ({ ...current, [id]: value }));
  };

  if (detail.courses.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a course to this class in Settings, then set due dates here.</p>;
  }

  return (
    <section aria-label="Due dates" className="space-y-6">
      <p className="text-sm text-muted-foreground">Pick a date and time for each module, in your own time zone. Clear a box to remove its due date.</p>
      {detail.courses.map((course) => (
        <div key={course.id} className="rounded-lg border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 font-semibold">{course.title}</h2>
          {course.modules.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">This course has no modules yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {course.modules.map((mod) => (
                <li key={mod.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor={`due-${mod.id}`} className="min-w-0 text-sm font-medium">
                    {mod.title}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`due-${mod.id}`}
                      type="datetime-local"
                      value={values[mod.id] ?? ""}
                      onChange={(event) => change(mod.id, event.target.value)}
                      className="h-11 min-w-0 rounded-md border-2 border-input bg-card px-3 text-base outline-none focus-visible:border-ring"
                    />
                    {values[mod.id] ? (
                      <Button type="button" variant="ghost" size="xs" onClick={() => change(mod.id, "")}>
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" loading={busy} disabled={busy} onClick={() => void save()}>
          Save due dates
        </Button>
        {saved ? <span role="status" className="text-sm text-muted-foreground">Saved.</span> : null}
      </div>
    </section>
  );
}
