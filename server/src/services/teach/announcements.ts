import { randomUUID } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import type { SessionUser } from "../../types/auth.js";
import { ConflictError, UnprocessableError } from "../../utils/errors.js";
import {
  ANNOUNCEMENT_ERROR_CODES,
  type AnnouncementDraft,
  type AnnouncementPreview,
  type AnnouncementSendBody,
  type AnnouncementSendResult,
  type AnnouncementSummary,
  type AnnouncementTestResult,
} from "../../shared/api/course-announcements.js";
import { appBaseUrl } from "../email/send.js";
import { escapeHtml } from "../email/format.js";
import { renderEmailLayout, renderEmailTemplate } from "../email/render.js";
import { CONFIRMED_ENROLLMENT_WHERE } from "../enrollment/lifecycle.js";
import { notify, type NotifyInput } from "../notifications/service.js";
import { requireCourseById } from "./access.js";

// An instructor sends a message to everyone enrolled in one of their courses. One announcement is
// one notify() event: a bell notice and an email for each learner, both subject to the learner's
// own notification settings for the Courses category. The send is guarded three ways: the course
// must be published, the instructor must confirm the audience size they saw in the preview, and
// each learner can receive a given announcement only once (the dedupe key).

const SEND_CHUNK = 500;
const REPEAT_WINDOW_MS = 10 * 60 * 1000;

type CourseForAnnouncement = { id: string; slug: string; title: string; status: string };

/** Distinct accounts with a confirmed enrollment. An enrollment not yet linked to an account has no one to notify. */
async function audienceUserIds(courseId: string): Promise<string[]> {
  const rows = await prisma.enrollment.findMany({
    where: { courseId, userId: { not: null }, ...CONFIRMED_ENROLLMENT_WHERE },
    select: { userId: true },
  });
  return [...new Set(rows.flatMap((row) => (row.userId ? [row.userId] : [])))];
}

function absoluteImages(images: string[]): string[] {
  return images.map((src) => (src.startsWith("/") ? `${appBaseUrl()}${src}` : src));
}

async function renderContent(course: CourseForAnnouncement, draft: AnnouncementDraft, name: string | null) {
  const url = `${appBaseUrl()}${draft.ctaPath}`;
  const html = await renderEmailTemplate("notify-learner-course-announcement", {
    name: name ?? "there",
    message: draft.message,
    steps: draft.steps,
    images: absoluteImages(draft.images),
    ctaLabel: draft.ctaLabel,
    url,
    escapeHtml,
  });
  const steps = draft.steps.length ? `\n\nHow to try it:\n${draft.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}` : "";
  const text = `Hi ${name ?? "there"},\n\n${draft.message}${steps}\n\n${draft.ctaLabel}: ${url}\n\nTried it? Tell us what you think, with the Give feedback button in the course or by writing back to your instructor.`;
  return { subject: `${draft.title} · ${course.title}`, html, text };
}

function announcementEvent(course: CourseForAnnouncement, draft: AnnouncementDraft, dedupeKey: string, recipients: NotifyInput["recipients"]): NotifyInput {
  return {
    type: "course.announcement",
    recipients,
    dedupeKey,
    title: draft.title,
    body: draft.message.length > 180 ? `${draft.message.slice(0, 177).trimEnd()}...` : draft.message,
    url: draft.ctaPath,
    courseId: course.id,
    email: ({ name }) => renderContent(course, draft, name),
  };
}

export async function previewAnnouncement(user: SessionUser, courseId: string, draft: AnnouncementDraft): Promise<AnnouncementPreview> {
  const course = await requireCourseById(user, courseId);
  const [recipients, content] = await Promise.all([audienceUserIds(courseId), renderContent(course, draft, user.name ?? null)]);
  return { recipientCount: recipients.length, subject: content.subject, html: await renderEmailLayout(content, appBaseUrl()) };
}

/** Sends the announcement to the instructor only, so they can see the bell notice and the email first. */
export async function sendTestAnnouncement(user: SessionUser, courseId: string, draft: AnnouncementDraft): Promise<AnnouncementTestResult> {
  const course = await requireCourseById(user, courseId);
  await notify(announcementEvent(course, draft, `announcement-test:${randomUUID()}`, [{ userId: user.id }]));
  return { sentTo: user.email };
}

export async function sendAnnouncement(user: SessionUser, courseId: string, body: AnnouncementSendBody): Promise<AnnouncementSendResult> {
  const course = await requireCourseById(user, courseId);
  if (course.status !== "PUBLISHED") {
    throw new UnprocessableError("Only a published course can send announcements.", ANNOUNCEMENT_ERROR_CODES.COURSE_NOT_PUBLISHED);
  }
  const userIds = await audienceUserIds(courseId);
  if (userIds.length === 0) throw new UnprocessableError("No learners are enrolled yet.", ANNOUNCEMENT_ERROR_CODES.NO_RECIPIENTS);
  if (userIds.length !== body.expectedRecipientCount) {
    throw new ConflictError(
      `The audience changed from ${body.expectedRecipientCount} to ${userIds.length} learners. Check the preview and send again.`,
      ANNOUNCEMENT_ERROR_CODES.AUDIENCE_CHANGED,
    );
  }
  const { expectedRecipientCount: _expected, ...draft } = body;
  // A double click or a retry must not email everyone twice.
  const repeat = await prisma.courseAnnouncement.findFirst({
    where: { courseId, title: draft.title, message: draft.message, createdAt: { gt: new Date(Date.now() - REPEAT_WINDOW_MS) } },
    select: { id: true },
  });
  if (repeat) {
    throw new ConflictError("This announcement was already sent a moment ago. It was not sent again.", ANNOUNCEMENT_ERROR_CODES.ALREADY_SENT);
  }
  const row = await prisma.courseAnnouncement.create({
    data: { courseId, authorId: user.id, ...draft, recipientCount: userIds.length },
    select: { id: true },
  });
  const recipients = userIds.map((userId) => ({ userId }));
  for (let at = 0; at < recipients.length; at += SEND_CHUNK) {
    await notify(announcementEvent(course, draft, `announcement:${row.id}`, recipients.slice(at, at + SEND_CHUNK)));
  }
  return { id: row.id, recipientCount: userIds.length };
}

export async function listAnnouncements(user: SessionUser, courseId: string): Promise<AnnouncementSummary[]> {
  await requireCourseById(user, courseId);
  const rows = await prisma.courseAnnouncement.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    steps: row.steps,
    images: row.images,
    ctaLabel: row.ctaLabel,
    ctaPath: row.ctaPath,
    recipientCount: row.recipientCount,
    authorName: row.author.name,
    createdAt: row.createdAt.toISOString(),
  }));
}
