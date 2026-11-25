"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { errorText, fromLocalInput } from "@/lib/classes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CoursePicker } from "@/components/classes/course-picker";
import type { ClassCourseRef, ClassSummary } from "@/shared/api/classes";

export function NewClassForm({ options, startOpen }: { options: ClassCourseRef[]; startOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [name, setName] = useState("");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus /> New class
      </Button>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give the class a name.");
    if (courseIds.length === 0) return setError("Pick at least one course.");
    const start = fromLocalInput(startsAt);
    const end = fromLocalInput(endsAt);
    if (start && end && end <= start) return setError("The end date must be after the start date.");
    setBusy(true);
    try {
      const created = await apiFetch<ClassSummary>("/api/v1/teach/classes", {
        method: "POST",
        json: { name: name.trim(), courseIds, startsAt: start, endsAt: end },
      });
      router.push(`/classes/${created.id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">New class</h2>
      <div className="space-y-2">
        <Label htmlFor="class-name">Class name</Label>
        <Input id="class-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="For example, CS 201 section B" />
      </div>
      <div className="space-y-2">
        <Label>Courses</Label>
        <CoursePicker options={options} selected={courseIds} onChange={setCourseIds} idPrefix="new-class" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="class-start">Start (optional)</Label>
          <Input id="class-start" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="class-end">End (optional)</Label>
          <Input id="class-end" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy} disabled={busy}>
          Create class
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
