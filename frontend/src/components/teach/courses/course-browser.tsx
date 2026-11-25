"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Settings2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isSafeAssetUrl } from "@/shared/lib/asset-url";
import type { BulkCourseSettingsInput, MentorCourseCard } from "@/shared/api/teach";
import { AI_GRADING_MODELS, AI_GRADING_MODEL_LABELS, aiGradingModelLabel, type AiGradingModel } from "@/shared/lib/ai-grading";
import { updateCoursesInBulk } from "@/server/actions/ai-grading";
import { toast } from "@/components/ui/app-toast";
import { BulkSelect } from "@/components/teach/bulk-select";

// My courses: the portfolio, a way straight into each course's Settings, and a bar to
// change the common settings for several ticked courses at once.

type BulkChange = Omit<BulkCourseSettingsInput, "courseIds">;

type StatusFilter = "all" | "PUBLISHED" | "DRAFT" | "attention";

export function CourseBrowser({ courses }: { courses: MentorCourseCard[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [saving, startSaving] = useTransition();
  // An older API sends no settings; then there is nothing to change in bulk.
  const canSelect = courses.some((course) => course.settings);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesQuery = !needle || course.title.toLowerCase().includes(needle) || course.description?.toLowerCase().includes(needle);
      const hasAttention = course.pendingReviews + course.openHelpRequests + course.inactiveLearners > 0;
      const matchesStatus = status === "all" || (status === "attention" ? hasAttention : course.status === status);
      return matchesQuery && matchesStatus;
    });
  }, [courses, query, status]);

  const visibleIds = visible.filter((course) => course.settings).map((course) => course.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const selectedIds = courses.filter((course) => selected.has(course.id)).map((course) => course.id);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function apply(change: BulkChange, what: string) {
    if (selectedIds.length === 0 || saving) return;
    const count = selectedIds.length;
    startSaving(async () => {
      try {
        const result = await updateCoursesInBulk({ courseIds: selectedIds, ...change });
        if (!result.ok) {
          toast(result.error || "Could not save. Please try again.", "error");
          return;
        }
        toast(`Saved. ${what} for ${count} ${count === 1 ? "course" : "courses"}.`, "success");
        setSelected(new Set());
        router.refresh();
      } catch {
        toast("Could not save. Check your connection and try again.", "error");
      }
    });
  }

  return <section aria-labelledby="course-list-title" className={cn(selectedIds.length > 0 && "pb-56 sm:pb-28")}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 id="course-list-title" className="text-lg font-semibold">Course portfolio</h2><p className="text-sm text-muted-foreground">{canSelect ? "Open a course, or tick several to change their settings together." : "Choose a course to manage its curriculum or cohort."}</p></div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative"><span className="sr-only">Search courses</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses" className="h-9 w-full pl-9 sm:w-56" /></label>
        <label><span className="sr-only">Filter course status</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-40"><option value="all">All courses</option><option value="PUBLISHED">Published</option><option value="DRAFT">Drafts</option><option value="attention">Needs attention</option></select></label>
      </div>
    </div>
    {canSelect && visibleIds.length > 0 ? <label className="mt-4 flex w-fit items-center gap-2.5 text-sm font-medium">
      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 accent-primary" />
      Select all {visibleIds.length} shown
    </label> : null}
    {visible.length ? <div className="mt-4 grid gap-5 lg:grid-cols-2">{visible.map((course) => <CourseCard key={course.id} course={course} selected={selected.has(course.id)} onToggle={() => toggle(course.id)} />)}</div> : <div className="mt-4 rounded-2xl border border-dashed p-10 text-center"><p className="text-sm font-medium">No courses match</p><p className="mt-1 text-sm text-muted-foreground">Try a different search or status filter.</p></div>}
    {selectedIds.length > 0 ? (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_16px_rgba(10,15,44,0.08)] backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
          <div className="col-span-2 flex items-center justify-between gap-3 sm:pr-2">
            <p className="text-sm font-semibold" role="status">
              {saving ? "Saving…" : `${selectedIds.length} ${selectedIds.length === 1 ? "course" : "courses"} selected`}
            </p>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded text-sm font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40">
              Clear
            </button>
          </div>
          <BulkSelect
            disabled={saving}
            label="Set chapter order for the selected courses"
            placeholder="Chapter order…"
            options={[["on", "Chapters in order"], ["off", "Any order"]]}
            onPick={(value) => apply({ sequential: value === "on" }, value === "on" ? "Chapters must be done in order" : "Chapters can be done in any order")}
          />
          <BulkSelect
            disabled={saving}
            label="Set quiz camera photos for the selected courses"
            placeholder="Quiz camera…"
            options={[["on", "Quiz camera on"], ["off", "Quiz camera off"]]}
            onPick={(value) => apply({ integritySnapshots: value === "on" }, `Quiz camera photos are ${value}`)}
          />
          <BulkSelect
            disabled={saving}
            label="Set AI first-pass review for the selected courses"
            placeholder="AI review…"
            options={[["on", "AI review on"], ["off", "AI review off"], ["default", "Use my default"]]}
            onPick={(value) => apply({ reviewDraft: value === "default" ? null : value === "on" }, `AI first-pass review ${value === "default" ? "uses your default" : `is ${value}`}`)}
          />
          <BulkSelect
            disabled={saving}
            label="Set instant grading for the selected courses"
            placeholder="Instant grading…"
            options={[["on", "Instant grading on"], ["off", "Instant grading off"], ["default", "Use my default"]]}
            onPick={(value) => apply({ instantGrading: value === "default" ? null : value === "on" }, `Instant grading ${value === "default" ? "uses your default" : `is ${value}`}`)}
          />
          <BulkSelect
            disabled={saving}
            label="Set the grading model for the selected courses"
            placeholder="AI model…"
            options={[...AI_GRADING_MODELS.map((id) => [id, `Use ${AI_GRADING_MODEL_LABELS[id]}`] as [string, string]), ["default", "Use my default"]]}
            onPick={(value) => apply({ model: value === "default" ? null : (value as AiGradingModel) }, value === "default" ? "The grading model uses your default" : `The grading model is ${aiGradingModelLabel(value)}`)}
          />
          <Link href="/ai-grading" className="px-1 text-sm font-medium text-primary underline-offset-2 hover:underline">
            Change my default
          </Link>
        </div>
      </div>
    ) : null}
  </section>;
}

function settingChips(settings: NonNullable<MentorCourseCard["settings"]>): string[] {
  return [
    settings.sequential ? "Chapters in order" : "Any order",
    settings.integritySnapshots ? "Quiz camera on" : null,
    settings.aiGrading.reviewDraft ? `AI review: ${aiGradingModelLabel(settings.aiGrading.model)}` : "AI review off",
    settings.aiGrading.instantGrading ? "Instant grading" : null,
  ].filter((chip): chip is string => Boolean(chip));
}

function CourseCard({ course, selected, onToggle }: { course: MentorCourseCard; selected: boolean; onToggle: () => void }) {
  const cover = course.coverUrl && isSafeAssetUrl(course.coverUrl)
    ? course.coverUrl
    : course.slug.includes("multi-vendor")
      ? "/showcase/multi-vendor-marketplace/freshmarket-marketplace-hd.png"
      : course.slug.includes("ticket")
        ? "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80"
        : "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80";
  const attention = course.pendingReviews > 0
    ? `${course.pendingReviews} answer${course.pendingReviews === 1 ? "" : "s"} to check`
    : course.openHelpRequests > 0
      ? `${course.openHelpRequests} learner question${course.openHelpRequests === 1 ? "" : "s"}`
      : course.inactiveLearners > 0
        ? `${course.inactiveLearners} inactive learner${course.inactiveLearners === 1 ? "" : "s"}`
        : null;

  return <article className={cn("flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card transition-colors hover:border-foreground/20", selected && "border-primary ring-2 ring-primary/30")}>
    <Link href={`/courses/${course.slug}/edit`} aria-label={`Open ${course.title} curriculum`} className="relative block overflow-hidden bg-muted">
      <Image unoptimized src={cover} alt="" width={1200} height={560} sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[2.3/1] w-full object-cover transition-transform duration-300 hover:scale-[1.02]" />
      <Badge variant={course.status === "PUBLISHED" ? "default" : "secondary"} className="absolute left-4 top-4 capitalize shadow-sm">{course.status.toLowerCase()}</Badge>
    </Link>
    <div className="flex flex-1 flex-col p-5 sm:p-6">
      <div className="flex items-start gap-3">
        {course.settings ? <input type="checkbox" aria-label={`Select ${course.title}`} checked={selected} onChange={onToggle} className="mt-1 size-5 shrink-0 accent-primary" /> : null}
        <Link href={`/courses/${course.slug}/edit`} className="w-fit max-w-full hover:underline hover:underline-offset-2"><h3 className="line-clamp-2 text-lg font-semibold leading-6 tracking-tight">{course.title}</h3></Link>
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{course.description || "Add a description in course settings."}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{course.chapterCount} chapters</span><span aria-hidden>·</span>
        <span>{course.learnerCount} learner{course.learnerCount === 1 ? "" : "s"}</span><span aria-hidden>·</span>
        <span>{course.averageProgress}% average progress</span>
      </div>
      {course.settings ? <ul aria-label="Settings" className="mt-3 flex flex-wrap gap-1.5">
        {settingChips(course.settings).map((chip) => <li key={chip} className="rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">{chip}</li>)}
      </ul> : null}
      {attention && <p className="mt-3 w-fit rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">{attention}</p>}
      <div className="mt-auto pt-5">
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Link href={`/courses/${course.slug}/edit`} className={cn(buttonVariants({ size: "lg" }), "gap-1.5 px-3.5")}>Curriculum <ArrowRight className="size-4" aria-hidden /></Link>
          <Link href={`/courses/${course.slug}/mentees`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-1.5 px-3.5")}><Users className="size-4" aria-hidden /> Learners</Link>
          <Link href={`/courses/${course.slug}/settings`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-1.5 px-3.5")}><Settings2 className="size-4" aria-hidden /> Settings</Link>
        </div>
      </div>
    </div>
  </article>;
}
