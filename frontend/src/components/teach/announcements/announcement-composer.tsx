"use client";

import { useEffect, useId, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Mail, Plus, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/app-toast";
import { ApiError, apiFetch } from "@/lib/api-client";
import { uploadAnnouncementScreenshot } from "@/lib/course-media-upload";
import {
  announcementProblems,
  announcementReducer,
  announcementSendErrorMessage,
  blankAnnouncement,
  characterCount,
  learnerCountLabel,
  screenshotFileProblem,
  SCREENSHOT_TYPES,
  starterAnnouncement,
  toAnnouncementDraft,
  type AnnouncementStarter,
} from "@/lib/course-announcements";
import {
  ANNOUNCEMENT_ERROR_CODES,
  ANNOUNCEMENT_LIMITS,
  type AnnouncementPreview,
  type AnnouncementSendResult,
  type AnnouncementTestResult,
} from "@/shared/api/course-announcements";
import { cn } from "@/lib/utils";

type Course = { id: string; slug: string; title: string; status: string };
type Upload = { id: number; name: string; progress: number; error: string | null };
type Busy = "preview" | "test" | "send" | null;

const STARTERS: { key: AnnouncementStarter; label: string; detail: string }[] = [
  { key: "module-version", label: "A new version of a module is ready", detail: "Fills in a message, three how-to steps and a button to the course." },
  { key: "blank", label: "Something else", detail: "Start from an empty form." },
];

function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.errors[0]?.message ?? error.message ?? fallback;
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AnnouncementComposer({ course }: { course: Course }) {
  const router = useRouter();
  const ids = useId();
  const published = course.status === "PUBLISHED";
  const [starter, setStarter] = useState<AnnouncementStarter>("blank");
  const [form, dispatch] = useReducer(announcementReducer, course.slug, blankAnnouncement);
  const [problems, setProblems] = useState<string[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  // `key` is the draft the preview was made from; `version` reloads the frame on every refresh.
  const [preview, setPreview] = useState<(AnnouncementPreview & { key: string; version: number }) | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const uploadCounter = useRef(0);

  const draft = useMemo(() => toAnnouncementDraft(form), [form]);
  const draftKey = useMemo(() => JSON.stringify(draft), [draft]);
  const previewIsCurrent = preview !== null && preview.key === draftKey;
  const uploading = uploads.some((upload) => !upload.error);
  const freeImageSlots = ANNOUNCEMENT_LIMITS.images - form.images.length - uploads.filter((upload) => !upload.error).length;
  const canSend = published && previewIsCurrent && preview.recipientCount > 0 && !uploading && busy === null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirming && !dialog.open) dialog.showModal();
    if (!confirming && dialog.open) dialog.close();
  }, [confirming]);

  function chooseStarter(next: AnnouncementStarter) {
    const current = starterAnnouncement(starter, course.slug);
    const edited = JSON.stringify(form) !== JSON.stringify(current);
    if (edited && !window.confirm("This replaces what you have written so far. Continue?")) return;
    setStarter(next);
    dispatch({ type: "reset", form: starterAnnouncement(next, course.slug) });
    setProblems([]);
    setNotice(null);
  }

  function setField(field: "title" | "message" | "ctaLabel" | "ctaPath", value: string) {
    dispatch({ type: "set", field, value });
  }

  function checkForm(): boolean {
    const found = announcementProblems(form);
    if (uploading) found.push("Wait for the screenshots to finish uploading.");
    setProblems(found);
    return found.length === 0;
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const chosen = Array.from(files);
    if (chosen.length > freeImageSlots) {
      toast(freeImageSlots > 0 ? `You can add ${freeImageSlots} more screenshot${freeImageSlots === 1 ? "" : "s"}.` : `You can add up to ${ANNOUNCEMENT_LIMITS.images} screenshots.`);
    }
    for (const file of chosen.slice(0, Math.max(0, freeImageSlots))) {
      const id = ++uploadCounter.current;
      const problem = screenshotFileProblem(file);
      setUploads((current) => [...current, { id, name: file.name, progress: 0, error: problem }]);
      if (problem) continue;
      void uploadAnnouncementScreenshot(course.id, file, (progress) => {
        setUploads((current) => current.map((upload) => (upload.id === id ? { ...upload, progress } : upload)));
      }).then(
        (url) => {
          setUploads((current) => current.filter((upload) => upload.id !== id));
          dispatch({ type: "addImage", url });
        },
        (error: unknown) => {
          setUploads((current) => current.map((upload) => (upload.id === id ? { ...upload, error: errorText(error, "The screenshot was not uploaded. Please try again.") } : upload)));
        },
      );
    }
  }

  async function runPreview() {
    if (!checkForm()) return;
    setBusy("preview");
    setNotice(null);
    try {
      const result = await apiFetch<AnnouncementPreview>(`/api/v1/teach/courses/${encodeURIComponent(course.id)}/announcements/preview`, { method: "POST", json: draft });
      setPreview((current) => ({ ...result, key: draftKey, version: (current?.version ?? 0) + 1 }));
      window.setTimeout(() => previewRef.current?.focus(), 0);
    } catch (error) {
      setNotice({ tone: "error", text: errorText(error, "The preview could not be made. Please try again.") });
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    if (!checkForm()) return;
    setBusy("test");
    setNotice(null);
    try {
      const result = await apiFetch<AnnouncementTestResult>(`/api/v1/teach/courses/${encodeURIComponent(course.id)}/announcements/test`, { method: "POST", json: draft });
      const text = `The test is on its way to you only. Look for it in the bell at the top of this page, and in your email at ${result.sentTo}. The email can take a minute.`;
      setNotice({ tone: "info", text });
      toast(text, "success", { title: "Test sent" });
    } catch (error) {
      setNotice({ tone: "error", text: errorText(error, "The test was not sent. Please try again.") });
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!preview || !canSend) return;
    setBusy("send");
    setNotice(null);
    try {
      const result = await apiFetch<AnnouncementSendResult>(`/api/v1/teach/courses/${encodeURIComponent(course.id)}/announcements`, {
        method: "POST",
        json: { ...draft, expectedRecipientCount: preview.recipientCount },
      });
      setConfirming(false);
      toast(`It went to ${learnerCountLabel(result.recipientCount)}. You can find it under Sent announcements.`, "success", { title: "Announcement sent" });
      setStarter("blank");
      dispatch({ type: "reset", form: blankAnnouncement(course.slug) });
      setPreview(null);
      router.refresh();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      const text = announcementSendErrorMessage(code, code ? undefined : errorText(error, ""));
      setConfirming(false);
      setNotice({ tone: "error", text });
      if (code === ANNOUNCEMENT_ERROR_CODES.AUDIENCE_CHANGED) setPreview(null);
      if (code === ANNOUNCEMENT_ERROR_CODES.ALREADY_SENT) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const sendLabel = previewIsCurrent ? `Send to ${learnerCountLabel(preview.recipientCount)}` : "Send to learners";
  const sendHint = !published
    ? "You can send it once the course is published."
    : uploading
      ? "Wait for the screenshots to finish uploading."
      : !preview
        ? "Preview it first. The preview shows how many learners get it."
        : !previewIsCurrent
          ? "You changed the announcement. Preview it again before you send it."
          : preview.recipientCount === 0
            ? "Nobody is enrolled in this course yet."
            : null;

  return (
    <div className="space-y-6">
      {!published ? (
        <p className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm leading-6 text-muted-foreground">
          This course is not published yet. You can write and preview an announcement and send a test to yourself, but it can only go to learners once the course is published.
        </p>
      ) : null}

      <section aria-labelledby={`${ids}-starter`} className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h2 id={`${ids}-starter`} className="text-base font-semibold">Start from</h2>
        <div role="group" aria-labelledby={`${ids}-starter`} className="mt-3 grid gap-3 sm:grid-cols-2">
          {STARTERS.map((item) => {
            const on = starter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={on}
                onClick={() => chooseStarter(item.key)}
                className={cn(
                  "rounded-xl border-2 p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                )}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">{item.detail}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby={`${ids}-form`} className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h2 id={`${ids}-form`} className="text-base font-semibold">Your announcement</h2>

        <Field id={`${ids}-title`} label="Title" value={form.title} limit={ANNOUNCEMENT_LIMITS.title} hint="Shown in the bell and as the email subject.">
          <Input id={`${ids}-title`} value={form.title} maxLength={ANNOUNCEMENT_LIMITS.title} onChange={(event) => setField("title", event.target.value)} aria-describedby={`${ids}-title-hint ${ids}-title-count`} />
        </Field>

        <Field id={`${ids}-message`} label="Message" value={form.message} limit={ANNOUNCEMENT_LIMITS.message} hint="Leave an empty line between paragraphs.">
          <Textarea id={`${ids}-message`} value={form.message} rows={8} maxLength={ANNOUNCEMENT_LIMITS.message} onChange={(event) => setField("message", event.target.value)} aria-describedby={`${ids}-message-hint ${ids}-message-count`} className="min-h-40" />
        </Field>

        <fieldset className="space-y-3">
          <legend className="text-sm font-bold">How-to steps <span className="font-normal text-muted-foreground">(optional, up to {ANNOUNCEMENT_LIMITS.steps})</span></legend>
          {form.steps.length ? (
            <ol className="space-y-3">
              {form.steps.map((step, index) => {
                const count = characterCount(step, ANNOUNCEMENT_LIMITS.step);
                const stepId = `${ids}-step-${index}`;
                return (
                  <li key={index} className="flex gap-2">
                    <span aria-hidden className="mt-3 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Textarea id={stepId} aria-label={`Step ${index + 1}`} aria-describedby={`${stepId}-count`} value={step} rows={1} maxLength={ANNOUNCEMENT_LIMITS.step} onChange={(event) => dispatch({ type: "setStep", index, value: event.target.value.replace(/\n/g, " ") })} className="min-h-12 py-2.5" />
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <div className="flex gap-0.5">
                          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => dispatch({ type: "moveStep", index, by: -1 })}><ArrowUp aria-hidden /></Button>
                          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Move step ${index + 1} down`} disabled={index === form.steps.length - 1} onClick={() => dispatch({ type: "moveStep", index, by: 1 })}><ArrowDown aria-hidden /></Button>
                          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove step ${index + 1}`} onClick={() => dispatch({ type: "removeStep", index })}><Trash2 aria-hidden /></Button>
                        </div>
                        <p id={`${stepId}-count`} className={cn("text-xs tabular-nums", count.over ? "text-destructive" : "text-muted-foreground")}>{count.text}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No steps yet. Add steps when learners need to do something, for example switch a module version.</p>
          )}
          <Button type="button" variant="outline" size="sm" disabled={form.steps.length >= ANNOUNCEMENT_LIMITS.steps} onClick={() => dispatch({ type: "addStep" })}><Plus aria-hidden />Add a step</Button>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-bold">Screenshots <span className="font-normal text-muted-foreground">(optional, up to {ANNOUNCEMENT_LIMITS.images}, PNG, JPG or WebP, 8 MB each)</span></legend>
          {form.images.length || uploads.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {form.images.map((url, index) => (
                <li key={url} className="relative overflow-hidden rounded-xl border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded image served by the API */}
                  <img src={url} alt={`Screenshot ${index + 1}`} className="aspect-video w-full object-cover" />
                  <Button type="button" variant="secondary" size="icon-xs" aria-label={`Remove screenshot ${index + 1}`} onClick={() => dispatch({ type: "removeImage", index })} className="absolute right-1.5 top-1.5"><X aria-hidden /></Button>
                </li>
              ))}
              {uploads.map((upload) => (
                <li key={upload.id} className="flex aspect-video flex-col justify-center gap-2 rounded-xl border border-dashed p-3 text-xs">
                  <span className="truncate font-medium">{upload.name}</span>
                  {upload.error ? (
                    <>
                      <span role="alert" className="text-destructive">{upload.error}</span>
                      <Button type="button" variant="ghost" size="xs" onClick={() => setUploads((current) => current.filter((item) => item.id !== upload.id))}>Dismiss</Button>
                    </>
                  ) : (
                    <>
                      <span className="h-1 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`Uploading ${upload.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={upload.progress}>
                        <span className="block h-full bg-primary transition-all" style={{ width: `${upload.progress}%` }} />
                      </span>
                      <span className="text-muted-foreground tabular-nums">Uploading {upload.progress}%</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          <input
            ref={fileInput}
            id={`${ids}-files`}
            type="file"
            accept={SCREENSHOT_TYPES.join(",")}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={freeImageSlots <= 0} onClick={() => fileInput.current?.click()}><ImagePlus aria-hidden />Add screenshots</Button>
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field id={`${ids}-cta-label`} label="Button label" value={form.ctaLabel} limit={ANNOUNCEMENT_LIMITS.ctaLabel}>
            <Input id={`${ids}-cta-label`} value={form.ctaLabel} maxLength={ANNOUNCEMENT_LIMITS.ctaLabel} onChange={(event) => setField("ctaLabel", event.target.value)} aria-describedby={`${ids}-cta-label-count`} />
          </Field>
          <Field id={`${ids}-cta-path`} label="Button path" hint="A page inside the app. The bell notice opens it too.">
            <Input id={`${ids}-cta-path`} value={form.ctaPath} maxLength={300} spellCheck={false} onChange={(event) => setField("ctaPath", event.target.value)} aria-describedby={`${ids}-cta-path-hint`} />
          </Field>
        </div>

        {problems.length ? (
          <div role="alert" className="rounded-xl border border-destructive/30 px-4 py-3 text-sm text-destructive">
            <p className="font-medium">Fix these first:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 border-t pt-5 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="outline" onClick={() => void runPreview()} loading={busy === "preview"} disabled={busy !== null && busy !== "preview"}><Eye aria-hidden />{previewIsCurrent ? "Refresh preview" : "Preview"}</Button>
          <Button type="button" variant="outline" onClick={() => void sendTest()} loading={busy === "test"} disabled={busy !== null && busy !== "test"}><Mail aria-hidden />Send a test to me</Button>
          <Button type="button" onClick={() => setConfirming(true)} disabled={!canSend} aria-describedby={sendHint ? `${ids}-send-hint` : undefined}><Send aria-hidden />{sendLabel}</Button>
        </div>
        {sendHint ? <p id={`${ids}-send-hint`} className="-mt-3 text-sm text-muted-foreground">{sendHint}</p> : null}
        <div aria-live="polite">
          {notice ? <p role={notice.tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm leading-6", notice.tone === "error" ? "border-destructive/30 text-destructive" : "bg-muted/30")}>{notice.text}</p> : null}
        </div>
      </section>

      {preview ? (
        <section aria-labelledby={`${ids}-preview`} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div ref={previewRef} tabIndex={-1} className="space-y-1 border-b px-5 py-4 outline-none sm:px-6">
            <h2 id={`${ids}-preview`} className="text-base font-semibold">Preview</h2>
            <p className="text-sm text-muted-foreground">
              Goes to <strong className="font-semibold text-foreground">{learnerCountLabel(preview.recipientCount)}</strong> enrolled in {course.title} right now.
            </p>
            <p className="text-sm"><span className="text-muted-foreground">Subject: </span><span className="font-medium">{preview.subject}</span></p>
            {!previewIsCurrent ? <p className="text-sm text-destructive">You changed the announcement after this preview. Refresh the preview to see it again.</p> : null}
          </div>
          <iframe key={preview.version} title="Email preview" sandbox="" srcDoc={preview.html} className="block h-[640px] w-full border-0 bg-background" />
        </section>
      ) : null}

      <dialog
        ref={dialogRef}
        onClose={() => setConfirming(false)}
        onCancel={(event) => { if (busy === "send") event.preventDefault(); }}
        onClick={(event) => { if (event.target === event.currentTarget && busy !== "send") setConfirming(false); }}
        aria-labelledby={`${ids}-confirm-title`}
        className="fixed inset-0 z-50 m-auto w-[min(30rem,calc(100vw-2rem))] max-w-none rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/60"
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={`${ids}-confirm-title`} className="text-lg font-semibold">Send this announcement?</h2>
            <p className="mt-1 text-sm text-muted-foreground">{course.title}</p>
          </div>
          <button type="button" onClick={() => setConfirming(false)} disabled={busy === "send"} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label="Close"><X className="size-4" aria-hidden /></button>
        </div>
        <div className="space-y-3 px-5 py-5 text-sm leading-6">
          <p className="break-words rounded-lg bg-muted/40 px-3 py-2 font-medium">{draft.title}</p>
          <p className="text-muted-foreground">
            It goes to <strong className="font-semibold text-foreground">{preview ? learnerCountLabel(preview.recipientCount) : "your learners"}</strong> enrolled in {course.title}: in the bell, and by email unless they turned off Courses emails.
          </p>
          <p className="text-muted-foreground">You cannot take it back after it is sent.</p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={busy === "send"}>Cancel</Button>
          <Button type="button" onClick={() => void send()} loading={busy === "send"} disabled={!canSend && busy !== "send"}><Send aria-hidden />{preview ? `Send to ${learnerCountLabel(preview.recipientCount)}` : "Send"}</Button>
        </div>
      </dialog>
    </div>
  );
}

function Field({ id, label, value, limit, hint, children }: { id: string; label: string; value?: string; limit?: number; hint?: string; children: ReactNode }) {
  const count = limit !== undefined ? characterCount(value ?? "", limit) : null;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <div className="flex items-start justify-between gap-3 text-xs">
        {hint ? <p id={`${id}-hint`} className="text-muted-foreground">{hint}</p> : <span />}
        {count ? <p id={`${id}-count`} className={cn("shrink-0 tabular-nums", count.over ? "text-destructive" : "text-muted-foreground")}>{count.text}</p> : null}
      </div>
    </div>
  );
}

