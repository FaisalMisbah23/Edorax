// GENERATED from server/src/shared — do not edit here. Run `pnpm sync-shared` in server/.
// Course announcements: an instructor tells everyone enrolled in a course that something changed,
// for example a new version of a module, with a few how-to steps, screenshots and a button. It
// reaches learners as a bell notice and an email.

export const ANNOUNCEMENT_LIMITS = {
  title: 120,
  message: 2000,
  step: 240,
  steps: 6,
  images: 3,
  ctaLabel: 40,
} as const;

export type AnnouncementDraft = {
  title: string;
  message: string;
  /** Short how-to steps, shown as a numbered list. */
  steps: string[];
  /** Public screenshot URLs, from the course image upload. */
  images: string[];
  ctaLabel: string;
  /** App-relative path the button opens, for example `/courses/dw-level-1`. */
  ctaPath: string;
};

export type AnnouncementPreview = {
  /** How many learners it would go to right now. */
  recipientCount: number;
  subject: string;
  /** The email as the learner sees it, for the instructor's preview. */
  html: string;
};

export type AnnouncementSendBody = AnnouncementDraft & {
  /** The count shown in the preview. The send is refused if the audience changed since. */
  expectedRecipientCount: number;
};

export type AnnouncementSendResult = { id: string; recipientCount: number };

export type AnnouncementTestResult = { sentTo: string };

export type AnnouncementSummary = {
  id: string;
  title: string;
  message: string;
  steps: string[];
  images: string[];
  ctaLabel: string;
  ctaPath: string;
  recipientCount: number;
  authorName: string | null;
  createdAt: string;
};

export const ANNOUNCEMENT_ERROR_CODES = {
  COURSE_NOT_PUBLISHED: "ANNOUNCEMENT_COURSE_NOT_PUBLISHED",
  AUDIENCE_CHANGED: "ANNOUNCEMENT_AUDIENCE_CHANGED",
  NO_RECIPIENTS: "ANNOUNCEMENT_NO_RECIPIENTS",
  ALREADY_SENT: "ANNOUNCEMENT_ALREADY_SENT",
} as const;
