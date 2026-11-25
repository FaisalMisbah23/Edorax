import {
  ANNOUNCEMENT_ERROR_CODES,
  ANNOUNCEMENT_LIMITS,
  type AnnouncementDraft,
} from "@/shared/api/course-announcements";

// The instructor's announcement form: its state, the two starters, the checks before a preview and
// the plain messages for the send errors. Kept free of React so it can be tested on its own.

export const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

export type AnnouncementForm = {
  title: string;
  message: string;
  steps: string[];
  images: string[];
  ctaLabel: string;
  ctaPath: string;
};

export type AnnouncementStarter = "module-version" | "blank";

export function blankAnnouncement(courseSlug: string): AnnouncementForm {
  return { title: "", message: "", steps: [], images: [], ctaLabel: "Open the course", ctaPath: `/courses/${courseSlug}` };
}

export function moduleVersionAnnouncement(courseSlug: string): AnnouncementForm {
  return {
    title: "A new version of a module is ready",
    message: [
      "We rewrote one of the modules in this course to make it clearer and easier to follow. The new version is ready for you now, and the old one is still there if you prefer it.",
      "Once you have tried it, please tell us which version worked better for you. You can vote in the \"Which version of this module was better?\" card in the course sidebar.",
    ].join("\n\n"),
    steps: [
      "Open the module in the course.",
      "Click Version under the module title.",
      "Pick the rewritten version. Your progress is kept, and you can switch back any time.",
    ],
    images: [],
    ctaLabel: "Open the course",
    ctaPath: `/courses/${courseSlug}`,
  };
}

export function starterAnnouncement(starter: AnnouncementStarter, courseSlug: string): AnnouncementForm {
  return starter === "module-version" ? moduleVersionAnnouncement(courseSlug) : blankAnnouncement(courseSlug);
}

export type AnnouncementAction =
  | { type: "reset"; form: AnnouncementForm }
  | { type: "set"; field: "title" | "message" | "ctaLabel" | "ctaPath"; value: string }
  | { type: "addStep" }
  | { type: "setStep"; index: number; value: string }
  | { type: "removeStep"; index: number }
  | { type: "moveStep"; index: number; by: -1 | 1 }
  | { type: "addImage"; url: string }
  | { type: "removeImage"; index: number };

export function announcementReducer(form: AnnouncementForm, action: AnnouncementAction): AnnouncementForm {
  switch (action.type) {
    case "reset":
      return action.form;
    case "set":
      return { ...form, [action.field]: action.value };
    case "addStep":
      return form.steps.length >= ANNOUNCEMENT_LIMITS.steps ? form : { ...form, steps: [...form.steps, ""] };
    case "setStep":
      if (action.index < 0 || action.index >= form.steps.length) return form;
      return { ...form, steps: form.steps.map((step, index) => (index === action.index ? action.value : step)) };
    case "removeStep":
      return { ...form, steps: form.steps.filter((_, index) => index !== action.index) };
    case "moveStep": {
      const to = action.index + action.by;
      if (action.index < 0 || action.index >= form.steps.length || to < 0 || to >= form.steps.length) return form;
      const steps = [...form.steps];
      [steps[action.index], steps[to]] = [steps[to]!, steps[action.index]!];
      return { ...form, steps };
    }
    case "addImage":
      if (form.images.length >= ANNOUNCEMENT_LIMITS.images || form.images.includes(action.url)) return form;
      return { ...form, images: [...form.images, action.url] };
    case "removeImage":
      return { ...form, images: form.images.filter((_, index) => index !== action.index) };
  }
}

/** What the API gets: trimmed text, with empty steps left out. */
export function toAnnouncementDraft(form: AnnouncementForm): AnnouncementDraft {
  return {
    title: form.title.trim(),
    message: form.message.trim(),
    steps: form.steps.map((step) => step.trim()).filter(Boolean),
    images: form.images,
    ctaLabel: form.ctaLabel.trim(),
    ctaPath: form.ctaPath.trim(),
  };
}

/** The problems that stop a preview or a send, in form order. Empty when the form is ready. */
export function announcementProblems(form: AnnouncementForm): string[] {
  const draft = toAnnouncementDraft(form);
  const problems: string[] = [];
  if (!draft.title) problems.push("Add a title.");
  else if (draft.title.length > ANNOUNCEMENT_LIMITS.title) problems.push(`The title can have at most ${ANNOUNCEMENT_LIMITS.title} characters.`);
  if (!draft.message) problems.push("Write the message.");
  else if (draft.message.length > ANNOUNCEMENT_LIMITS.message) problems.push(`The message can have at most ${ANNOUNCEMENT_LIMITS.message} characters.`);
  if (form.steps.some((step) => step.trim().length > ANNOUNCEMENT_LIMITS.step)) {
    problems.push(`Each step can have at most ${ANNOUNCEMENT_LIMITS.step} characters.`);
  }
  if (!draft.ctaLabel) problems.push("Name the button.");
  else if (draft.ctaLabel.length > ANNOUNCEMENT_LIMITS.ctaLabel) problems.push(`The button label can have at most ${ANNOUNCEMENT_LIMITS.ctaLabel} characters.`);
  if (!isAppPath(draft.ctaPath)) problems.push("Use a button path inside the app, such as /courses/your-course.");
  return problems;
}

export function isAppPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !/\s/.test(path) && path.length <= 300;
}

/** "12 / 120" style counter text, and whether the value is over its limit. */
export function characterCount(value: string, limit: number): { text: string; over: boolean } {
  const length = value.trim().length;
  return { text: `${length} / ${limit}`, over: length > limit };
}

/** A plain reason the file cannot be used as a screenshot, or null when it can. */
export function screenshotFileProblem(file: { type: string; size: number }): string | null {
  if (!(SCREENSHOT_TYPES as readonly string[]).includes(file.type)) return "Choose a PNG, JPG or WebP image.";
  if (!file.size) return "That file is empty. Choose another image.";
  if (file.size > MAX_SCREENSHOT_BYTES) return "Choose an image smaller than 8 MB.";
  return null;
}

/** Plain words for the send errors the API can answer with. */
export function announcementSendErrorMessage(code: string | undefined, fallback?: string): string {
  switch (code) {
    case ANNOUNCEMENT_ERROR_CODES.AUDIENCE_CHANGED:
      return "The number of learners changed since your preview. Refresh the preview to see the new number, then send again.";
    case ANNOUNCEMENT_ERROR_CODES.ALREADY_SENT:
      return "This announcement was already sent a moment ago, so it was not sent again.";
    case ANNOUNCEMENT_ERROR_CODES.COURSE_NOT_PUBLISHED:
      return "This course is not published, so there is nobody to send it to. Publish the course first.";
    case ANNOUNCEMENT_ERROR_CODES.NO_RECIPIENTS:
      return "Nobody is enrolled in this course yet, so there is nobody to send it to.";
    default:
      return fallback || "The announcement was not sent. Please try again.";
  }
}

export function learnerCountLabel(count: number): string {
  return `${count} learner${count === 1 ? "" : "s"}`;
}
