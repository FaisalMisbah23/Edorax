"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import type { AiGradingCourseRow, AiGradingUpdateInput, AiGradingView } from "@/shared/api/teach";
import { aiGradingModelLabel, resolveAiGrading, type AiGradingModel, type AiGradingValues } from "@/shared/lib/ai-grading";
import { updateAiGrading } from "@/server/actions/ai-grading";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BulkSelect, SELECT_CLASS } from "./bulk-select";

// One default for all the instructor's courses, then a row per course that uses the
// default or has its own value. Every change saves at once; several rows can be changed
// together from the bar that appears when rows are ticked.

type Setting = keyof AiGradingValues;
type CourseChange = NonNullable<AiGradingUpdateInput["courses"]>[number];

const onOff = (value: boolean) => (value ? "On" : "Off");
const money = (value: number) => `$${value < 1 ? value.toFixed(2) : String(Number(value.toFixed(2)))}`;

/** What the page will look like once the server accepts the change, so controls answer at once. */
function applyLocally(view: AiGradingView, input: AiGradingUpdateInput): AiGradingView {
  const defaults = { ...view.defaults, ...input.defaults };
  const changes = new Map((input.courses ?? []).map(({ courseId, ...change }) => [courseId, change]));
  return {
    ...view,
    defaults,
    defaultsSaved: view.defaultsSaved || Boolean(input.defaults),
    courses: view.courses.map((course) => {
      const own = { ...course.own, ...changes.get(course.id) };
      const rowDefaults = course.ownedByYou ? defaults : course.defaults;
      return { ...course, own, defaults: rowDefaults, effective: resolveAiGrading(own, rowDefaults, rowDefaults) };
    }),
  };
}

const hasOwnValue = (course: AiGradingCourseRow) => course.own.reviewDraft !== null || course.own.instantGrading !== null || course.own.model !== null;

export function AiGradingBoard({ initial }: { initial: AiGradingView }) {
  const [view, setView] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const haiku = view.models.find((model) => model.id === "claude-haiku-5-5");
  const sonnet = view.models.find((model) => model.id === "claude-sonnet-5-5");
  const ownCount = view.courses.filter(hasOwnValue).length;
  const mineCount = view.courses.filter((course) => course.ownedByYou).length;
  const allSelected = view.courses.length > 0 && selected.size === view.courses.length;

  function save(input: AiGradingUpdateInput, savedText: string) {
    const before = view;
    setView(applyLocally(view, input));
    setStatus(null);
    const fail = (text: string) => {
      setView(before);
      setStatus({ kind: "error", text });
      toast(text, "error");
    };
    startSaving(async () => {
      try {
        const result = await updateAiGrading(input);
        if (result.ok) {
          setView(result.view);
          setStatus({ kind: "saved", text: savedText });
          // The line under the default can be off screen far down the list; say it here too.
          toast(savedText, "success");
          return;
        }
        fail(result.error || "Could not save. Please try again.");
      } catch {
        fail("Could not save. Check your connection and try again.");
      }
    });
  }

  const saveDefault = (change: NonNullable<AiGradingUpdateInput["defaults"]>, what: string) =>
    save({ defaults: change }, `Saved. ${what} for every course that uses the default.`);

  function saveCourse(course: AiGradingCourseRow, change: Omit<CourseChange, "courseId">) {
    save({ courses: [{ courseId: course.id, ...change }] }, `Saved for ${course.title}.`);
  }

  function saveSelected(change: Omit<CourseChange, "courseId">, what: string) {
    const ids = view.courses.filter((course) => selected.has(course.id)).map((course) => course.id);
    if (ids.length === 0) return;
    save({ courses: ids.map((courseId) => ({ courseId, ...change })) }, `Saved. ${what} for ${ids.length} ${ids.length === 1 ? "course" : "courses"}.`);
    setSelected(new Set());
  }

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      {!view.platform.reviewDraftAvailable ? (
        <p className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
          Automatic review drafts are switched off for the whole platform right now. Your choices here are saved and apply once they are back on.
        </p>
      ) : null}

      <section aria-labelledby="ai-default-title" className="mt-6 overflow-hidden rounded-2xl border bg-card">
        <div className="border-b bg-muted/15 px-5 py-4 sm:px-6">
          <h2 id="ai-default-title" className="text-base font-semibold">Default for all your courses</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {mineCount === 0
              ? "Applies to every course you own."
              : `Applies to your ${mineCount} ${mineCount === 1 ? "course" : "courses"}, except where a course has its own setting below.`}
          </p>
        </div>
        <div className="divide-y">
          <DefaultRow
            title="AI first-pass review"
            payer="Edorax pays"
            description="Claude drafts feedback and a score for every open answer. You approve or edit it. Nothing reaches the learner until you send it."
          >
            <Toggle
              label="AI first-pass review for all courses"
              checked={view.defaults.reviewDraft}
              onChange={(value) => saveDefault({ reviewDraft: value }, `AI first-pass review is ${value ? "on" : "off"}`)}
            />
          </DefaultRow>
          <DefaultRow
            title="Instant grading of short answers"
            payer="The learner's own AI key pays"
            description="Text short answers are marked right away instead of waiting for you. A learner without a key is asked to add one first. Link and project answers still come to you."
          >
            <Toggle
              label="Instant grading of short answers for all courses"
              checked={view.defaults.instantGrading}
              onChange={(value) => saveDefault({ instantGrading: value }, `Instant grading is ${value ? "on" : "off"}`)}
            />
          </DefaultRow>
          <DefaultRow
            title="Grading model"
            payer="Used for the first-pass review"
            description={
              haiku && sonnet
                ? `Haiku is the cheap default (${money(haiku.inputUsdPerMillion)} in, ${money(haiku.outputUsdPerMillion)} out per million tokens). Sonnet costs about ${Math.round(sonnet.inputUsdPerMillion / haiku.inputUsdPerMillion)} times more (${money(sonnet.inputUsdPerMillion)} in, ${money(sonnet.outputUsdPerMillion)} out) and reads code better.`
                : "Haiku is the cheap default. Sonnet costs more and reads code better."
            }
          >
            <div role="radiogroup" aria-label="Default grading model" className="inline-flex rounded-lg border bg-background p-0.5">
              {view.models.map((model) => {
                const active = view.defaults.model === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => (active ? undefined : saveDefault({ model: model.id }, `The grading model is ${model.label}`))}
                    className={cn(
                      "h-9 min-w-20 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                      active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                    )}
                  >
                    {model.label}
                  </button>
                );
              })}
            </div>
          </DefaultRow>
        </div>
      </section>

      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {saving ? <p role="status" className="text-muted-foreground">Saving…</p> : null}
        {!saving && status?.kind === "saved" ? <p role="status" className="text-emerald-700 dark:text-emerald-400">{status.text}</p> : null}
        {!saving && status?.kind === "error" ? <p role="alert" className="text-destructive">{status.text}</p> : null}
      </div>

      <section aria-labelledby="ai-courses-title" className="mt-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="ai-courses-title" className="text-base font-semibold">Your courses</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {view.courses.length === 0
                ? "You have no courses yet."
                : `${view.courses.length - ownCount} of ${view.courses.length} use the default. ${ownCount} ${ownCount === 1 ? "has" : "have"} their own setting. Tick courses to change several at once.`}
            </p>
          </div>
        </div>

        {view.courses.length > 0 ? (
          <div className="@container mt-3 overflow-hidden rounded-2xl border bg-card">
            <div className="hidden items-center gap-3 border-b bg-muted/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground @4xl:grid @4xl:grid-cols-[1.5rem_minmax(0,1fr)_9.5rem_9.5rem_9.5rem_8.75rem]">
              <input
                type="checkbox"
                aria-label="Select all courses"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(view.courses.map((course) => course.id)))}
                className="size-4 accent-primary"
              />
              <span>Course</span>
              <span>First-pass review</span>
              <span>Instant grading</span>
              <span>Model</span>
              <span className="sr-only">Reset</span>
            </div>
            <label className="flex items-center gap-3 border-b px-4 py-3 text-sm font-medium @4xl:hidden">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(view.courses.map((course) => course.id)))}
                className="size-4 accent-primary"
              />
              Select all courses
            </label>
            <ul className="divide-y">
              {view.courses.map((course) => (
                <CourseRow
                  key={course.id}
                  course={course}
                  models={view.models}
                  selected={selected.has(course.id)}
                  onToggle={() => toggleRow(course.id)}
                  onChange={(change) => saveCourse(course, change)}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        The platform makes at most {view.platform.dailyLimit.toLocaleString("en-US")} review drafts a day across all instructors. Capstone projects are checked on their own model and are not changed here.
      </p>

      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_16px_rgba(10,15,44,0.08)] backdrop-blur">
          <div className="mx-auto grid max-w-5xl grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
            <div className="col-span-2 flex items-center justify-between gap-3 sm:pr-2">
              <p className="text-sm font-semibold">
                {selected.size} {selected.size === 1 ? "course" : "courses"} selected
              </p>
              <button type="button" onClick={() => setSelected(new Set())} className="rounded text-sm font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40">
                Clear
              </button>
            </div>
            <BulkSelect
              label="Set first-pass review for the selected courses"
              placeholder="Review…"
              options={[["on", "Review on"], ["off", "Review off"], ["default", "Use the default"]]}
              onPick={(value) => saveSelected({ reviewDraft: value === "default" ? null : value === "on" }, `First-pass review ${value === "default" ? "uses the default" : `is ${value}`}`)}
            />
            <BulkSelect
              label="Set instant grading for the selected courses"
              placeholder="Instant grading…"
              options={[["on", "Instant grading on"], ["off", "Instant grading off"], ["default", "Use the default"]]}
              onPick={(value) => saveSelected({ instantGrading: value === "default" ? null : value === "on" }, `Instant grading ${value === "default" ? "uses the default" : `is ${value}`}`)}
            />
            <BulkSelect
              label="Set the model for the selected courses"
              placeholder="Model…"
              options={[...view.models.map((model) => [model.id, `Use ${model.label}`] as [string, string]), ["default", "Use the default"]]}
              onPick={(value) => saveSelected({ model: value === "default" ? null : (value as AiGradingModel) }, value === "default" ? "The model uses the default" : `The model is ${aiGradingModelLabel(value)}`)}
            />
            <Button type="button" variant="outline" className="h-10" onClick={() => saveSelected({ reviewDraft: null, instantGrading: null, model: null }, "Everything is back on the default")}>
              <RotateCcw className="size-4" aria-hidden />
              Reset to default
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DefaultRow({ title, payer, description, children }: { title: string; payer: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
          {title}
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{payer}</span>
        </p>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex h-10 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <span className={cn("relative h-7 w-12 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left]", checked ? "left-[1.375rem]" : "left-0.5")} />
      </span>
      <span className="w-7 text-left text-sm font-semibold text-foreground">{onOff(checked)}</span>
    </button>
  );
}

function CourseRow({
  course,
  models,
  selected,
  onToggle,
  onChange,
}: {
  course: AiGradingCourseRow;
  models: AiGradingView["models"];
  selected: boolean;
  onToggle: () => void;
  onChange: (change: Omit<CourseChange, "courseId">) => void;
}) {
  const own = hasOwnValue(course);
  const switchCell = (setting: Exclude<Setting, "model">, label: string) => (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted-foreground @4xl:sr-only">{label}</span>
      <select
        aria-label={`${label} for ${course.title}`}
        value={course.own[setting] === null ? "default" : course.own[setting] ? "on" : "off"}
        onChange={(event) => onChange({ [setting]: event.target.value === "default" ? null : event.target.value === "on" })}
        className={cn(SELECT_CLASS, course.own[setting] !== null && "border-primary/60 font-medium")}
      >
        <option value="default">Default ({onOff(course.defaults[setting])})</option>
        <option value="on">On</option>
        <option value="off">Off</option>
      </select>
    </label>
  );

  return (
    <li className={cn("grid gap-3 px-4 py-3.5 @4xl:grid-cols-[1.5rem_minmax(0,1fr)_9.5rem_9.5rem_9.5rem_8.75rem] @4xl:items-center", selected && "bg-primary/5")}>
      <div className="flex items-start gap-3 @4xl:contents">
        <input type="checkbox" aria-label={`Select ${course.title}`} checked={selected} onChange={onToggle} className="mt-1 size-4 shrink-0 accent-primary @4xl:mt-0" />
        <div className="min-w-0">
          <Link href={`/courses/${course.slug}/settings`} className="block truncate text-sm font-medium text-foreground hover:underline">
            {course.title}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {own ? <span className="font-semibold text-primary">Own setting</span> : course.ownedByYou ? "Uses the default" : "Uses the owner's default"}
            {course.status !== "PUBLISHED" ? ` · ${course.status === "ARCHIVED" ? "Archived" : "Draft"}` : ""}
            {!course.ownedByYou && own ? " · owned by another instructor" : ""}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 @md:grid-cols-3 @4xl:contents">
        {switchCell("reviewDraft", "First-pass review")}
        {switchCell("instantGrading", "Instant grading")}
        <label className="col-span-2 block min-w-0 @md:col-span-1">
          <span className="mb-1 block text-xs font-medium text-muted-foreground @4xl:sr-only">Model</span>
          <select
            aria-label={`Model for ${course.title}`}
            value={course.own.model ?? "default"}
            onChange={(event) => onChange({ model: event.target.value === "default" ? null : (event.target.value as AiGradingModel) })}
            className={cn(SELECT_CLASS, course.own.model !== null && "border-primary/60 font-medium")}
          >
            <option value="default">Default ({aiGradingModelLabel(course.defaults.model)})</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {own ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange({ reviewDraft: null, instantGrading: null, model: null })}
          aria-label={`Reset ${course.title} to the default`}
          className="w-full @4xl:w-auto"
        >
          <RotateCcw className="size-4" aria-hidden />
          Use default
        </Button>
      ) : (
        <span className="hidden @4xl:block" />
      )}
    </li>
  );
}
