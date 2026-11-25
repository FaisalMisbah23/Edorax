import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

// The automatic drafts need the platform key; give the suite a fake one. No call leaves
// the process: every draft below goes through an injected generator.
vi.mock("../../src/config/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>();
  return { ...actual, env: { ...actual.env, ANTHROPIC_API_KEY: "test-key", AI_REVIEW_MODEL: "claude-haiku-5-5" }, aiReviewAutoDraftAvailable: true };
});

import type * as EnvModule from "../../src/config/env.js";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { createSession } from "../../src/services/auth/session.js";
import { ensureAutoDraft } from "../../src/services/teach/ai/auto-draft.js";
import type { generateReviewDraft } from "../../src/services/teach/ai/review-draft.js";
import { createCourseFixture } from "../helpers/fixtures.js";

// AI grading settings: one default per instructor, overrides per course, changed in bulk.
// Covers the access checks on the bulk update and that the automatic review drafts
// follow course value, then owner default, then platform default.

const app = createApp();
const URL = "/api/v1/teach/ai-grading";
const HAIKU = "claude-haiku-5-5";
const SONNET = "claude-sonnet-5-5";

let fx: Awaited<ReturnType<typeof createCourseFixture>>;
let mentorToken = "";
let otherToken = "";
let coCreatorToken = "";
let evaluatorToken = "";
let secondCourseId = "";
let otherCourseId = "";
let blockId = "";
let responseId = "";
const extraUserIds: string[] = [];

async function makeMentor(label: string) {
  const user = await prisma.user.create({
    data: { email: `${label}-${randomUUID().slice(0, 8)}@test.local`, name: label, role: "MENTOR", emailVerified: new Date() },
  });
  extraUserIds.push(user.id);
  return { user, token: (await createSession(user.id, randomBytes(32).toString("hex"))).sessionToken };
}

beforeAll(async () => {
  fx = await createCourseFixture();
  mentorToken = (await createSession(fx.mentor.id, randomBytes(32).toString("hex"))).sessionToken;

  const second = await prisma.course.create({ data: { slug: `aig-second-${fx.tag}`, title: `Second ${fx.tag}`, status: "PUBLISHED", mentorId: fx.mentor.id } });
  secondCourseId = second.id;

  const other = await makeMentor("other-mentor");
  otherToken = other.token;
  const otherCourse = await prisma.course.create({ data: { slug: `aig-other-${fx.tag}`, title: `Other ${fx.tag}`, status: "PUBLISHED", mentorId: other.user.id } });
  otherCourseId = otherCourse.id;

  const coCreator = await makeMentor("co-creator");
  coCreatorToken = coCreator.token;
  const evaluator = await makeMentor("evaluator");
  evaluatorToken = evaluator.token;
  await prisma.courseInstructor.createMany({
    data: [
      { courseId: fx.course.id, userId: coCreator.user.id, role: "COURSE_CREATOR" },
      { courseId: fx.course.id, userId: evaluator.user.id, role: "SUBMISSION_EVALUATOR" },
    ],
  });

  blockId = `blk-aig-${fx.tag}`;
  await prisma.block.create({
    data: { id: blockId, chapterId: fx.chapterA.id, type: "OPEN_QUESTION", order: 3, points: 5, config: { prompt: "Explain the trade-off.", minWords: 1, submissionMode: "url" } },
  });
  const response = await prisma.response.create({
    data: {
      blockId,
      userId: fx.learner.id,
      enrollmentId: fx.enrollment.id,
      attempt: 1,
      status: "PENDING_REVIEW",
      payload: { text: "I chose Postgres because the data is relational.", url: "https://example.com/work" },
      maxScore: 5,
    },
  });
  responseId = response.id;
});

afterAll(async () => {
  await prisma.response.deleteMany({ where: { blockId } });
  await prisma.block.deleteMany({ where: { id: blockId } });
  await prisma.course.deleteMany({ where: { id: { in: [secondCourseId, otherCourseId] } } });
  await fx.cleanup();
  await prisma.session.deleteMany({ where: { userId: { in: extraUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
});

const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const mentor = () => as(mentorToken);
type Row = { id: string; ownedByYou: boolean; own: Record<string, unknown>; effective: Record<string, unknown>; defaults: Record<string, unknown> };
const row = (body: { data: { courses: Row[] } }, id: string) => body.data.courses.find((course) => course.id === id);
const courseColumns = (id: string) =>
  prisma.course.findUniqueOrThrow({ where: { id }, select: { aiReviewDraft: true, aiInstantGrading: true, aiGradingModel: true } });

async function resetAll() {
  await prisma.aiGradingDefault.deleteMany({ where: { userId: { in: [fx.mentor.id, ...extraUserIds] } } });
  await prisma.course.updateMany({
    where: { id: { in: [fx.course.id, secondCourseId, otherCourseId] } },
    data: { aiReviewDraft: null, aiInstantGrading: null, aiGradingModel: null },
  });
}

describe("GET /api/v1/teach/ai-grading", () => {
  it("lists the instructor's courses on the platform default until they choose", async () => {
    await resetAll();
    const res = await request(app).get(URL).set(mentor());
    expect(res.status).toBe(200);
    expect(res.body.data.defaults).toEqual({ reviewDraft: true, instantGrading: false, model: HAIKU });
    expect(res.body.data.defaultsSaved).toBe(false);
    expect(res.body.data.models.map((model: { id: string }) => model.id)).toEqual([HAIKU, SONNET]);
    expect(res.body.data.models[0]).toMatchObject({ label: "Haiku", inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.5 });
    expect(res.body.data.models[1]).toMatchObject({ label: "Sonnet", inputUsdPerMillion: 2, outputUsdPerMillion: 10 });
    expect(row(res.body, fx.course.id)).toMatchObject({
      ownedByYou: true,
      own: { reviewDraft: null, instantGrading: null, model: null },
      effective: { reviewDraft: true, instantGrading: false, model: HAIKU },
    });
    expect(row(res.body, secondCourseId)).toBeDefined();
    expect(row(res.body, otherCourseId)).toBeUndefined();
  });

  it("is for instructors only", async () => {
    expect((await request(app).get(URL).set(as(fx.learnerToken))).status).toBe(403);
    expect((await request(app).put(URL).set(as(fx.learnerToken)).send({ defaults: { instantGrading: true } })).status).toBe(403);
    expect((await request(app).get(URL)).status).toBe(401);
  });
});

describe("PUT /api/v1/teach/ai-grading", () => {
  it("saves a default that every course without its own value follows", async () => {
    await resetAll();
    const res = await request(app).put(URL).set(mentor()).send({ defaults: { instantGrading: true, model: SONNET } });
    expect(res.status).toBe(200);
    expect(res.body.data.defaults).toEqual({ reviewDraft: true, instantGrading: true, model: SONNET });
    expect(res.body.data.defaultsSaved).toBe(true);
    for (const id of [fx.course.id, secondCourseId]) {
      expect(row(res.body, id)).toMatchObject({ own: { instantGrading: null, model: null }, effective: { reviewDraft: true, instantGrading: true, model: SONNET } });
    }
    // Another instructor's course keeps following its own owner.
    const other = await request(app).get(URL).set(as(otherToken));
    expect(row(other.body, otherCourseId)?.effective).toEqual({ reviewDraft: true, instantGrading: false, model: HAIKU });
  });

  it("changes several courses at once, and null puts a course back on the default", async () => {
    await resetAll();
    const res = await request(app)
      .put(URL)
      .set(mentor())
      .send({ courses: [{ courseId: fx.course.id, model: SONNET, reviewDraft: false }, { courseId: secondCourseId, model: SONNET }] });
    expect(res.status).toBe(200);
    expect(row(res.body, fx.course.id)).toMatchObject({ own: { reviewDraft: false, instantGrading: null, model: SONNET }, effective: { reviewDraft: false, model: SONNET } });
    expect(row(res.body, secondCourseId)).toMatchObject({ own: { reviewDraft: null, model: SONNET }, effective: { reviewDraft: true, model: SONNET } });

    const reset = await request(app).put(URL).set(mentor()).send({ courses: [{ courseId: fx.course.id, model: null, reviewDraft: null, instantGrading: null }] });
    expect(row(reset.body, fx.course.id)).toMatchObject({ own: { reviewDraft: null, instantGrading: null, model: null }, effective: { reviewDraft: true, model: HAIKU } });
    expect(row(reset.body, secondCourseId)?.own.model).toBe(SONNET);
  });

  it("refuses the whole request when one course belongs to someone else", async () => {
    await resetAll();
    const res = await request(app)
      .put(URL)
      .set(mentor())
      .send({ defaults: { instantGrading: true }, courses: [{ courseId: fx.course.id, model: SONNET }, { courseId: otherCourseId, model: SONNET }] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NOT_COURSE_MENTOR");
    // Nothing was written: not the caller's own course, not the default, not the other course.
    expect(await courseColumns(fx.course.id)).toEqual({ aiReviewDraft: null, aiInstantGrading: null, aiGradingModel: null });
    expect(await courseColumns(otherCourseId)).toEqual({ aiReviewDraft: null, aiInstantGrading: null, aiGradingModel: null });
    expect(await prisma.aiGradingDefault.findUnique({ where: { userId: fx.mentor.id } })).toBeNull();
  });

  it("answers 404 for a course that does not exist", async () => {
    const res = await request(app).put(URL).set(mentor()).send({ courses: [{ courseId: "no-such-course", model: SONNET }] });
    expect(res.status).toBe(404);
  });

  it("lets a co-creator change the course but not a submission evaluator", async () => {
    await resetAll();
    const allowed = await request(app).put(URL).set(as(coCreatorToken)).send({ courses: [{ courseId: fx.course.id, model: SONNET }] });
    expect(allowed.status).toBe(200);
    // The co-creator sees the course, marked as owned by someone else.
    expect(row(allowed.body, fx.course.id)).toMatchObject({ ownedByYou: false, own: { model: SONNET } });

    const refused = await request(app).put(URL).set(as(evaluatorToken)).send({ courses: [{ courseId: fx.course.id, model: HAIKU }] });
    expect(refused.status).toBe(403);
    expect((await courseColumns(fx.course.id)).aiGradingModel).toBe(SONNET);
    expect(row((await request(app).get(URL).set(as(evaluatorToken))).body, fx.course.id)).toBeUndefined();
  });

  it("accepts only the Haiku and Sonnet model ids", async () => {
    for (const body of [
      { defaults: { model: "claude-opus-5-5" } },
      { courses: [{ courseId: fx.course.id, model: "claude-opus-5-5" }] },
      { courses: [{ courseId: fx.course.id, model: "gpt-4o" }] },
      { courses: [{ courseId: fx.course.id, mentorId: "x" }] },
    ]) {
      expect((await request(app).put(URL).set(mentor()).send(body)).status).toBe(400);
    }
  });
});

describe("whose default a co-created course follows", () => {
  it("follows the co-creator's default while the owner has none, and the owner's once it is set", async () => {
    await resetAll();
    // Nobody has a default yet: the co-creator's would be the one the course follows.
    const before = await request(app).get(URL).set(as(coCreatorToken));
    expect(row(before.body, fx.course.id)).toMatchObject({ ownedByYou: false, followsYourDefault: true, effective: { instantGrading: false, model: HAIKU } });

    const saved = await request(app).put(URL).set(as(coCreatorToken)).send({ defaults: { instantGrading: true, model: SONNET } });
    expect(row(saved.body, fx.course.id)).toMatchObject({ followsYourDefault: true, own: { instantGrading: null, model: null }, effective: { instantGrading: true, model: SONNET } });
    // The owner sees the same effective values and that the default is not theirs.
    const ownerView = await request(app).get(URL).set(mentor());
    expect(row(ownerView.body, fx.course.id)).toMatchObject({ ownedByYou: true, followsYourDefault: false, effective: { instantGrading: true, model: SONNET } });
    // A course the co-creator is not on is untouched.
    expect(row(ownerView.body, secondCourseId)?.effective).toEqual({ reviewDraft: true, instantGrading: false, model: HAIKU });

    // The owner saves a default: it wins on their course.
    await request(app).put(URL).set(mentor()).send({ defaults: { instantGrading: false } });
    const after = await request(app).get(URL).set(as(coCreatorToken));
    expect(row(after.body, fx.course.id)).toMatchObject({ followsYourDefault: false, effective: { instantGrading: false, model: HAIKU } });
    // The course's own value still beats every default.
    await request(app).put(URL).set(as(coCreatorToken)).send({ courses: [{ courseId: fx.course.id, model: SONNET }] });
    expect(row((await request(app).get(URL).set(mentor())).body, fx.course.id)?.effective.model).toBe(SONNET);
  });

  it("uses the co-creator who joined first, and never a submission evaluator", async () => {
    await resetAll();
    const later = await makeMentor("later-co-creator");
    await prisma.courseInstructor.create({ data: { courseId: fx.course.id, userId: later.user.id, role: "COURSE_CREATOR" } });
    const evaluator = await prisma.courseInstructor.findFirstOrThrow({ where: { courseId: fx.course.id, role: "SUBMISSION_EVALUATOR" } });
    await prisma.aiGradingDefault.create({ data: { userId: evaluator.userId, instantGrading: true, model: SONNET } });
    expect(row((await request(app).get(URL).set(mentor())).body, fx.course.id)?.effective).toEqual({ reviewDraft: true, instantGrading: false, model: HAIKU });

    await request(app).put(URL).set(as(later.token)).send({ defaults: { model: SONNET } });
    await request(app).put(URL).set(as(coCreatorToken)).send({ defaults: { model: HAIKU, reviewDraft: false } });
    const view = await request(app).get(URL).set(as(later.token));
    expect(row(view.body, fx.course.id)).toMatchObject({ followsYourDefault: false, effective: { reviewDraft: false, model: HAIKU } });
    await prisma.courseInstructor.deleteMany({ where: { userId: later.user.id } });
  });
});

describe("PUT /api/v1/teach/courses/bulk-settings", () => {
  const BULK = "/api/v1/teach/courses/bulk-settings";
  const columns = (id: string) =>
    prisma.course.findUniqueOrThrow({ where: { id }, select: { sequential: true, integritySnapshots: true, aiGradingModel: true, aiInstantGrading: true } });

  it("changes chapter order, quiz camera and AI grading for several courses, leaving the rest alone", async () => {
    await resetAll();
    await prisma.course.updateMany({ where: { id: { in: [fx.course.id, secondCourseId] } }, data: { sequential: true, integritySnapshots: false } });
    const res = await request(app).put(BULK).set(mentor()).send({ courseIds: [fx.course.id, secondCourseId], integritySnapshots: true, model: SONNET });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ updated: 2 });
    for (const id of [fx.course.id, secondCourseId]) {
      expect(await columns(id)).toEqual({ sequential: true, integritySnapshots: true, aiGradingModel: SONNET, aiInstantGrading: null });
    }

    await request(app).put(BULK).set(mentor()).send({ courseIds: [secondCourseId], sequential: false, model: null });
    expect(await columns(secondCourseId)).toEqual({ sequential: false, integritySnapshots: true, aiGradingModel: null, aiInstantGrading: null });
    expect((await columns(fx.course.id)).sequential).toBe(true);

    // The My courses list shows the same values.
    const list = await request(app).get("/api/v1/teach/courses").set(mentor());
    const card = list.body.data.courses.find((course: { id: string }) => course.id === fx.course.id);
    expect(card.settings).toEqual({ sequential: true, integritySnapshots: true, aiGrading: { reviewDraft: true, instantGrading: false, model: SONNET }, aiGradingOwn: true });
  });

  it("refuses everything when one course is outside the caller's courses", async () => {
    await prisma.course.updateMany({ where: { id: { in: [fx.course.id, otherCourseId] } }, data: { integritySnapshots: false } });
    const res = await request(app).put(BULK).set(mentor()).send({ courseIds: [fx.course.id, otherCourseId], integritySnapshots: true });
    expect(res.status).toBe(403);
    expect((await columns(fx.course.id)).integritySnapshots).toBe(false);
    expect((await columns(otherCourseId)).integritySnapshots).toBe(false);

    expect((await request(app).put(BULK).set(as(evaluatorToken)).send({ courseIds: [fx.course.id], sequential: false })).status).toBe(403);
    expect((await request(app).put(BULK).set(as(fx.learnerToken)).send({ courseIds: [fx.course.id], sequential: false })).status).toBe(403);
    expect((await request(app).put(BULK).set(mentor()).send({ courseIds: ["no-such-course"], sequential: false })).status).toBe(404);
    expect((await columns(fx.course.id)).sequential).toBe(true);
  });

  it("rejects an empty list, unknown settings and other models", async () => {
    for (const body of [{ courseIds: [], sequential: true }, { courseIds: [fx.course.id], status: "ARCHIVED" }, { courseIds: [fx.course.id], model: "claude-opus-5-5" }]) {
      expect((await request(app).put(BULK).set(mentor()).send(body)).status).toBe(400);
    }
  });
});

describe("automatic review drafts follow the settings", () => {
  const draft = { summary: "Fine.", strengths: ["Clear."], improvements: ["Compare."], feedback: "Compare one alternative.", suggestedVerdict: "NEEDS_REVISION" as const, suggestedScore: 3, confidence: "MEDIUM" as const };
  const generator = () =>
    vi.fn<typeof generateReviewDraft>(async (_context, options) => ({ draft, model: options?.model ?? "none", usage: { inputTokens: 1000, outputTokens: 200 } }) as Awaited<ReturnType<typeof generateReviewDraft>>);

  it("uses the platform model, then the owner's default, then the course's own model", async () => {
    await resetAll();
    const generate = generator();
    expect((await ensureAutoDraft(responseId, { generate, force: true }))?.model).toBe(HAIKU);

    await request(app).put(URL).set(mentor()).send({ defaults: { model: SONNET } });
    expect((await ensureAutoDraft(responseId, { generate, force: true }))?.model).toBe(SONNET);

    await request(app).put(URL).set(mentor()).send({ courses: [{ courseId: fx.course.id, model: HAIKU }] });
    expect((await ensureAutoDraft(responseId, { generate, force: true }))?.model).toBe(HAIKU);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate.mock.calls.map(([, options]) => options?.model)).toEqual([HAIKU, SONNET, HAIKU]);
    // Sonnet is priced from the same table as the capstone checks: 1000 in, 200 out.
    expect((await prisma.response.findUniqueOrThrow({ where: { id: responseId } })).aiDraftCostMicroUsd).toBe(200);
  });

  it("makes no draft when the course switches them off, and the default switch applies to courses that follow it", async () => {
    await resetAll();
    const generate = generator();

    await request(app).put(URL).set(mentor()).send({ courses: [{ courseId: fx.course.id, reviewDraft: false }] });
    expect(await ensureAutoDraft(responseId, { generate, force: true })).toBeNull();

    // Default off, course back on the default: still no draft.
    await request(app).put(URL).set(mentor()).send({ defaults: { reviewDraft: false }, courses: [{ courseId: fx.course.id, reviewDraft: null }] });
    expect(await ensureAutoDraft(responseId, { generate, force: true })).toBeNull();
    expect(generate).not.toHaveBeenCalled();

    // The course's own "on" wins over a default that is off.
    await request(app).put(URL).set(mentor()).send({ courses: [{ courseId: fx.course.id, reviewDraft: true }] });
    expect(await ensureAutoDraft(responseId, { generate, force: true })).not.toBeNull();
    expect(generate).toHaveBeenCalledTimes(1);

    const queue = await request(app).get("/api/v1/teach/review").set(mentor());
    expect(queue.body.data.items.find((item: { id: string }) => item.id === responseId)?.autoDraft).toBe(true);
  });
});

describe("the per-course Settings page", () => {
  it("shows the same values and only takes the old checkbox when it changes something", async () => {
    await resetAll();
    await request(app).put(URL).set(mentor()).send({ defaults: { instantGrading: true } });
    const settingsUrl = `/api/v1/teach/courses/${fx.course.slug}/settings`;
    const view = (await request(app).get(settingsUrl).set(mentor())).body.data;
    expect(view.autoGradeOpenQuestions).toBe(true);
    expect(view.aiGrading).toEqual({ own: { reviewDraft: null, instantGrading: null, model: null }, effective: { reviewDraft: true, instantGrading: true, model: HAIKU } });

    const body = {
      title: view.title, description: "", coverUrl: "", projectGoal: "", difficulty: "", estimatedHours: "",
      sequential: true, pricingType: "FREE", priceDollars: "", currency: "USD",
    };
    const patchUrl = `/api/v1/teach/courses/${fx.course.id}/settings`;
    // Echoing the current value, or leaving it out, keeps the course on the default.
    expect((await request(app).patch(patchUrl).set(mentor()).send({ ...body, autoGradeOpenQuestions: true })).status).toBeLessThan(300);
    expect((await request(app).patch(patchUrl).set(mentor()).send(body)).status).toBeLessThan(300);
    expect((await courseColumns(fx.course.id)).aiInstantGrading).toBeNull();

    // An older screen that unticks the box sets the course's own value.
    expect((await request(app).patch(patchUrl).set(mentor()).send({ ...body, autoGradeOpenQuestions: false })).status).toBeLessThan(300);
    expect((await courseColumns(fx.course.id)).aiInstantGrading).toBe(false);
    expect((await request(app).get(settingsUrl).set(mentor())).body.data.autoGradeOpenQuestions).toBe(false);
  });
});
