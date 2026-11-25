"use client";

import { useId, useRef, useState } from "react";
import { Check, ChevronDown, ThumbsUp } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  MODULE_VERSION_NOTE_MAX,
  type ModuleVersionFeedbackView,
  type ModuleVersionOption,
  type ModuleVersionsItem,
} from "../../shared/api/module-versions";

/**
 * What the host app does when a learner picks a version or votes. The package only draws the
 * controls: web passes server actions, desktop would pass its IPC calls. Each call throws an
 * Error with a message the learner can read when it fails.
 */
export type ModuleVersionActions = {
  /** Store the choice, then move the learner to the first chapter of that version. */
  choose: (moduleKey: string, versionKey: string) => Promise<void>;
  saveFeedback: (moduleKey: string, versionKey: string, note: string | null) => Promise<ModuleVersionFeedbackView>;
  removeFeedback: (moduleKey: string) => Promise<void>;
};

/** Show the counter once the note gets close to the limit. */
export const NOTE_COUNTER_FROM = MODULE_VERSION_NOTE_MAX - 200;

const focusRing =
  "outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow";

/** "2 lessons, 15 min", or "1 lesson" when no lesson has an estimate. */
export function versionSummary(option: Pick<ModuleVersionOption, "chapterCount" | "estimatedMinutes">): string {
  const lessons = `${option.chapterCount} ${option.chapterCount === 1 ? "lesson" : "lessons"}`;
  return option.estimatedMinutes ? `${lessons}, ${option.estimatedMinutes} min` : lessons;
}

export function currentVersion(item: ModuleVersionsItem): ModuleVersionOption | undefined {
  return item.versions.find((option) => option.key === item.chosenVersionKey) ?? item.versions[0];
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * A small "Version: ..." button under a module's title. It opens a short list of the versions,
 * each with its lesson count and minutes. Picking one hands over to the host to save and move.
 */
export function ModuleVersionSwitch({
  item,
  onChoose,
}: {
  item: ModuleVersionsItem;
  onChoose?: ModuleVersionActions["choose"];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = currentVersion(item);

  const pick = async (versionKey: string) => {
    if (!onChoose || pending) return;
    if (versionKey === item.chosenVersionKey) {
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    setPending(versionKey);
    setError("");
    try {
      await onChoose(item.moduleKey, versionKey);
      setOpen(false);
    } catch (caught) {
      setError(errorMessage(caught, "That version could not be opened. Please try again."));
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      className="px-4 pb-2 pl-12"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Version of ${item.moduleTitle}: ${current?.label ?? "Original"}. Change version`}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          focusRing,
        )}
      >
        <span className="shrink-0 font-semibold">Version:</span>
        <span className="min-w-0 truncate">{current?.label ?? "Original"}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <ul id={listId} aria-label={`Versions of ${item.moduleTitle}`} className="mt-1 space-y-1">
          {item.versions.map((option) => {
            const chosen = option.key === item.chosenVersionKey;
            return (
              <li key={option.key}>
                <button
                  type="button"
                  aria-current={chosen ? "true" : undefined}
                  disabled={Boolean(pending) || (!chosen && !option.firstChapterSlug)}
                  onClick={() => void pick(option.key)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-60",
                    chosen ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                    focusRing,
                  )}
                >
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center" aria-hidden>
                    {chosen ? <Check className="size-4 text-primary" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium text-foreground">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {pending === option.key ? "Opening..." : versionSummary(option)}
                      {chosen ? <span className="sr-only">, the version you are reading</span> : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Remount the card with this key so a newer saved vote from the server replaces local edits. */
export function feedbackCardKey(item: ModuleVersionsItem): string {
  return `${item.moduleKey}|${item.feedback?.versionKey ?? ""}|${item.feedback?.updatedAt ?? ""}`;
}

/**
 * The vote card under a module's lessons: one thumbs-up per version, an optional note, Save,
 * and a way to remove the vote. It starts from the learner's saved vote when there is one.
 */
export function ModuleVersionFeedbackCard({
  item,
  actions,
}: {
  item: ModuleVersionsItem;
  actions?: Pick<ModuleVersionActions, "saveFeedback" | "removeFeedback">;
}) {
  const [saved, setSaved] = useState<ModuleVersionFeedbackView | null>(item.feedback);
  const [picked, setPicked] = useState<string | null>(item.feedback?.versionKey ?? null);
  const [note, setNote] = useState(item.feedback?.note ?? "");
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const headingId = useId();
  const noteId = useId();
  const counterId = useId();

  const trimmed = note.trim();
  const changed = picked !== (saved?.versionKey ?? null) || trimmed !== (saved?.note ?? "");
  const savedLabel = saved ? item.versions.find((option) => option.key === saved.versionKey)?.label : null;
  const showCounter = note.length >= NOTE_COUNTER_FROM;

  const save = async () => {
    if (!actions || !picked || busy) return;
    setBusy("save");
    setError("");
    setStatus("");
    try {
      const view = await actions.saveFeedback(item.moduleKey, picked, trimmed || null);
      setSaved(view);
      setNote(view.note ?? "");
      setStatus("Thanks. Your vote is saved.");
    } catch (caught) {
      setError(errorMessage(caught, "Your vote was not saved. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!actions || busy) return;
    setBusy("remove");
    setError("");
    setStatus("");
    try {
      await actions.removeFeedback(item.moduleKey);
      setSaved(null);
      setPicked(null);
      setNote("");
      setStatus("Your vote is removed.");
    } catch (caught) {
      setError(errorMessage(caught, "Your vote was not removed. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="mx-3 mb-3 mt-2 rounded-lg border border-border bg-background/60 p-3 text-sm"
    >
      <h3 id={headingId} className="text-sm font-semibold text-foreground">
        Which version of this module was better?
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {saved && savedLabel ? `You voted for ${savedLabel}.` : "Optional. It helps us improve the course."}
      </p>
      <div role="group" aria-labelledby={headingId} className="mt-2 flex flex-col gap-1.5">
        {item.versions.map((option) => {
          const on = picked === option.key;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={on}
              disabled={Boolean(busy)}
              onClick={() => setPicked(option.key)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-60",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted",
                focusRing,
              )}
            >
              <ThumbsUp className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 break-words">{option.label}</span>
            </button>
          );
        })}
      </div>
      <label htmlFor={noteId} className="mt-3 block text-xs font-medium text-foreground">
        Anything to add? (optional)
      </label>
      <textarea
        id={noteId}
        value={note}
        maxLength={MODULE_VERSION_NOTE_MAX}
        rows={3}
        disabled={Boolean(busy)}
        aria-describedby={showCounter ? counterId : undefined}
        onChange={(event) => setNote(event.target.value)}
        placeholder="What made it better for you?"
        className="mt-1 block w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"
      />
      {showCounter ? (
        <p id={counterId} className="mt-1 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {note.length}/{MODULE_VERSION_NOTE_MAX}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!actions || !picked || !changed || Boolean(busy)}
          aria-busy={busy === "save" || undefined}
          className={cn(
            "inline-flex h-9 items-center rounded-md border-2 border-primary bg-primary px-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50",
            focusRing,
          )}
        >
          {busy === "save" ? "Saving..." : saved ? "Save changes" : "Save"}
        </button>
        {saved ? (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={!actions || Boolean(busy)}
            className={cn(
              "inline-flex h-9 items-center rounded-md px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50",
              focusRing,
            )}
          >
            {busy === "remove" ? "Removing..." : "Remove my vote"}
          </button>
        ) : null}
      </div>
      <p aria-live="polite" className={cn("text-xs text-muted-foreground", status && "mt-2")}>
        {status}
      </p>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
