import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { createSession } from "../../src/services/auth/session.js";
import { createCourseFixture } from "../helpers/fixtures.js";

// An instructor's announcement to everyone enrolled: who may send it, what it checks first, and
// what each learner receives.

const app = createApp();
let fx: Awaited<ReturnType<typeof createCourseFixture>>;
let mentorToken = "";
let optedOutId = "";
let pendingId = "";
let draftCourseId = "";
const extraUserIds: string[] = [];

const draft = () => ({
  title: "A new version of module 2 is ready",
  message: "We wrote module 2 again, shorter and plainer.\n\nYou can switch any time and your progress is kept.",
  steps: ["Open module 2 in the course.", "Click Version under the module title.", "Pick the rewritten version."],
  images: ["/api/v1/media/courses/abc/announcement/0123456789abcdef0123456789abcdef.png"],
  ctaLabel: "Open the course",
  ctaPath: `/courses/${fx.course.slug}`,
});
const mentor = () => ({ Authorization: `Bearer ${mentorToken}` });
const base = () => `/api/v1/teach/courses/${fx.course.id}/announcements`;

beforeAll(async () => {
  fx = await createCourseFixture();
  mentorToken = (await createSession(fx.mentor.id)).sessionToken;
  // A learner who switched off Courses emails, and one whose enrollment is still waiting for payment.
  const optedOut = await prisma.user.create({ data: { email: `optout-${fx.tag}@test.local`, name: "Opted Out", role: "MENTEE", emailVerified: new Date() } });
  optedOutId = optedOut.id;
  await prisma.notificationPreference.create({ data: { userId: optedOut.id, emailOptOut: ["course"], inAppOptOut: [] } });
  await prisma.enrollment.create({ data: { courseId: fx.course.id, userId: optedOut.id, lifecycle: "ACTIVE", status: "IN_PROGRESS", source: "DIRECT", startedAt: new Date() } });
  const pending = await prisma.user.create({ data: { email: `pending-${fx.tag}@test.local`, name: "Pending", role: "MENTEE", emailVerified: new Date() } });
  pendingId = pending.id;
  await prisma.enrollment.create({ data: { courseId: fx.course.id, userId: pending.id, lifecycle: "PAYMENT_REQUIRED", status: "IN_PROGRESS", source: "DIRECT" } });
  const draftCourse = await prisma.course.create({ data: { slug: `draft-${fx.tag}`, title: "Draft course", status: "DRAFT", mentorId: fx.mentor.id } });
  draftCourseId = draftCourse.id;
  extraUserIds.push(optedOut.id, pending.id);
});

afterAll(async () => {
  await prisma.courseAnnouncement.deleteMany({ where: { courseId: { in: [fx.course.id, draftCourseId] } } });
  await prisma.emailOutbox.deleteMany({ where: { userId: { in: [fx.learner.id, fx.mentor.id, ...extraUserIds] } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [fx.learner.id, fx.mentor.id, ...extraUserIds] } } });
  await prisma.notificationPreference.deleteMany({ where: { userId: { in: extraUserIds } } });
  await prisma.enrollment.deleteMany({ where: { userId: { in: extraUserIds } } });
  await prisma.course.delete({ where: { id: draftCourseId } });
  await prisma.session.deleteMany({ where: { userId: fx.mentor.id } });
  await fx.cleanup();
  await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
});

describe("course announcements", () => {
  it("is for the course's instructor only", async () => {
    const asLearner = await request(app).post(`${base()}/preview`).set({ Authorization: `Bearer ${fx.learnerToken}` }).send(draft());
    expect([401, 403]).toContain(asLearner.status);
    expect((await request(app).get(base()).set({ Authorization: `Bearer ${fx.learnerToken}` })).status).toBeGreaterThanOrEqual(401);
  });

  it("refuses a button that leaves the app and a title that is missing", async () => {
    const outside = await request(app).post(`${base()}/preview`).set(mentor()).send({ ...draft(), ctaPath: "https://example.com/x" });
    expect(outside.status).toBe(400);
    const untitled = await request(app).post(`${base()}/preview`).set(mentor()).send({ ...draft(), title: " " });
    expect(untitled.status).toBe(400);
  });

  it("previews who it would reach and the email as written", async () => {
    const res = await request(app).post(`${base()}/preview`).set(mentor()).send(draft());
    expect(res.status).toBe(200);
    // The learner and the opted-out learner count. The unpaid enrollment does not.
    expect(res.body.data.recipientCount).toBe(2);
    expect(res.body.data.subject).toContain("A new version of module 2 is ready");
    expect(res.body.data.html).toContain("Pick the rewritten version.");
    expect(res.body.data.html).toContain("Open the course");
    expect(res.body.data.html).toContain("/api/v1/media/courses/abc/announcement/");
  });

  it("sends a test to the instructor alone", async () => {
    const res = await request(app).post(`${base()}/test`).set(mentor()).send(draft());
    expect(res.status).toBe(200);
    expect(res.body.data.sentTo).toBe(fx.mentor.email);
    expect(await prisma.notification.count({ where: { userId: fx.mentor.id, type: "course.announcement" } })).toBe(1);
    expect(await prisma.emailOutbox.count({ where: { toEmail: fx.mentor.email, type: "course.announcement" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: fx.learner.id, type: "course.announcement" } })).toBe(0);
  });

  it("will not send when the audience is not the one the instructor saw", async () => {
    const res = await request(app).post(base()).set(mentor()).send({ ...draft(), expectedRecipientCount: 99 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ANNOUNCEMENT_AUDIENCE_CHANGED");
    expect(await prisma.courseAnnouncement.count({ where: { courseId: fx.course.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: fx.learner.id, type: "course.announcement" } })).toBe(0);
  });

  it("will not send from a course that is not published", async () => {
    const res = await request(app).post(`/api/v1/teach/courses/${draftCourseId}/announcements`).set(mentor()).send({ ...draft(), expectedRecipientCount: 0 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ANNOUNCEMENT_COURSE_NOT_PUBLISHED");
  });

  it("sends to every confirmed learner, as a bell notice and an email each, honouring email settings", async () => {
    const res = await request(app).post(base()).set(mentor()).send({ ...draft(), expectedRecipientCount: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data.recipientCount).toBe(2);

    for (const userId of [fx.learner.id, optedOutId]) {
      const notice = await prisma.notification.findFirst({ where: { userId, type: "course.announcement", dedupeKey: `announcement:${res.body.data.id}` } });
      expect(notice?.title).toBe("A new version of module 2 is ready");
      expect(notice?.url).toBe(`/courses/${fx.course.slug}`);
    }
    // The learner who switched off Courses emails gets the bell notice only.
    expect(await prisma.emailOutbox.count({ where: { userId: fx.learner.id, dedupeKey: { startsWith: `announcement:${res.body.data.id}` } } })).toBe(1);
    expect(await prisma.emailOutbox.count({ where: { userId: optedOutId, dedupeKey: { startsWith: `announcement:${res.body.data.id}` } } })).toBe(0);
    // The waiting enrollment hears nothing.
    expect(await prisma.notification.count({ where: { userId: pendingId, type: "course.announcement" } })).toBe(0);
    const mail = await prisma.emailOutbox.findFirstOrThrow({ where: { userId: fx.learner.id, dedupeKey: { startsWith: `announcement:${res.body.data.id}` } } });
    expect(mail.subject).toContain(fx.course.title);
    expect(mail.html).toContain("Test Learner");
    expect(mail.text).toContain("How to try it:");
  });

  it("will not send the same announcement twice in a row", async () => {
    const res = await request(app).post(base()).set(mentor()).send({ ...draft(), expectedRecipientCount: 2 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ANNOUNCEMENT_ALREADY_SENT");
    expect(await prisma.courseAnnouncement.count({ where: { courseId: fx.course.id } })).toBe(1);
  });

  it("lists what was sent, newest first", async () => {
    const res = await request(app).get(base()).set(mentor());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ title: "A new version of module 2 is ready", recipientCount: 2, authorName: "Test Mentor" });
  });
});
