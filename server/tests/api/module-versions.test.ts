import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { Prisma } from "../../src/generated/prisma/index.js";
import { createSession } from "../../src/services/auth/session.js";
import { certificateEligibility } from "../../src/services/certificates/service.js";
import { upgradeEnrollmentToRelease } from "../../src/services/courses/releases.js";
import type { ResolvedCertificateSettings } from "../../src/shared/lib/certificates.js";
import { completeChapter, createCourseFixture, createModuleVersionsFixture } from "../helpers/fixtures.js";

// A module with an alternative version: what the learner reads, how progress counts, the vote
// they can leave.

const app = createApp();
let fx: Awaited<ReturnType<typeof createModuleVersionsFixture>>;
let plain: Awaited<ReturnType<typeof createCourseFixture>>;
let outsiderId = "";
let outsiderToken = "";

beforeAll(async () => {
  fx = await createModuleVersionsFixture();
  plain = await createCourseFixture();
  const outsider = await prisma.user.create({ data: { email: `outsider-${fx.tag}@test.local`, name: "Outsider", role: "MENTEE", emailVerified: new Date() } });
  outsiderId = outsider.id;
  outsiderToken = (await createSession(outsider.id)).sessionToken;
});

afterAll(async () => {
  await fx.cleanup();
  await plain.cleanup();
  await prisma.session.deleteMany({ where: { userId: { in: [outsiderId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [outsiderId] } } });
});

const learner = () => ({ Authorization: `Bearer ${fx.learnerToken}` });
const base = () => `/api/v1/courses/${fx.course.slug}`;
const choose = (versionKey: string, moduleKey = "m2", auth = learner()) =>
  request(app).put(`${base()}/modules/${moduleKey}/version`).set(auth).send({ versionKey });
const read = (chapterSlug: string) => request(app).get(`${base()}/chapters/${chapterSlug}`).set(learner());
const moduleTwo = (body: { data: { modules: { id: string; chapters: { slug: string }[]; completedCount: number }[] } }) =>
  body.data.modules.find(module => module.id === fx.module2.id)!;
const enrollmentRow = () => prisma.enrollment.findUniqueOrThrow({ where: { id: fx.enrollment.id } });

async function resetLearner() {
  await prisma.chapterProgress.deleteMany({ where: { enrollmentId: fx.enrollment.id } });
  await prisma.moduleVersionFeedback.deleteMany({ where: { enrollmentId: fx.enrollment.id } });
  await prisma.enrollment.update({ where: { id: fx.enrollment.id },
    data: { moduleVersions: Prisma.DbNull, releaseId: fx.release.id, percentComplete: 0, chaptersCompleted: 0, status: "IN_PROGRESS", completedAt: null } });
  await prisma.course.update({ where: { id: fx.course.id }, data: { activeReleaseId: fx.release.id } });
}

describe("module versions for a learner", () => {
  beforeEach(resetLearner);

  it("lists the versions with the default chosen", async () => {
    const res = await request(app).get(`${base()}/module-versions`).set(learner());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      courseSlug: fx.course.slug,
      modules: [{
        moduleId: fx.module2.id, moduleKey: "m2", moduleTitle: "Module 2", moduleOrder: 2,
        versions: [
          { key: "default", label: "Original lessons", chapterCount: 2, estimatedMinutes: 15, firstChapterSlug: "basics-one" },
          { key: "v2", label: "Rewritten: shorter and plainer", chapterCount: 1, estimatedMinutes: 8, firstChapterSlug: "basics-v2-one" },
        ],
        chosenVersionKey: "default",
        feedback: null,
      }],
    });
  });

  it("shows only the default chapters to a learner on the default", async () => {
    const res = await read("chapter-b");
    expect(res.status).toBe(200);
    expect(moduleTwo(res.body).chapters.map(chapter => chapter.slug)).toEqual(["basics-one", "basics-two"]);
    expect(res.body.data.next.slug).toBe("basics-one");
    expect((await read("basics-v2-one")).status).toBe(404);
  });

  it("switches the reader, next and previous to the chosen version", async () => {
    const res = await choose("v2");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ courseSlug: fx.course.slug, moduleKey: "m2", chosenVersionKey: "v2", firstChapterSlug: "basics-v2-one" });
    expect((await enrollmentRow()).moduleVersions).toEqual({ m2: "v2" });

    const before = await read("chapter-b");
    expect(before.body.data.next.slug).toBe("basics-v2-one");
    const chosen = await read("basics-v2-one");
    expect(chosen.status).toBe(200);
    expect(chosen.body.data.prev.slug).toBe("chapter-b");
    expect(chosen.body.data.next).toBeNull();
    expect(moduleTwo(chosen.body).chapters.map(chapter => chapter.slug)).toEqual(["basics-v2-one"]);
    expect((await read("basics-one")).status).toBe(404);

    const listed = await request(app).get(`${base()}/module-versions`).set(learner());
    expect(listed.body.data.modules[0].chosenVersionKey).toBe("v2");
  });

  it("counts only the chosen version in module completion and the course percentage, and keeps progress on a switch", async () => {
    await completeChapter(fx.enrollment.id, fx.chapterA.id);
    await completeChapter(fx.enrollment.id, fx.basicsOne.id);

    const toV2 = await choose("v2");
    expect(toV2.body.data).toMatchObject({ percentComplete: 33, chaptersCompleted: 1 });

    await completeChapter(fx.enrollment.id, fx.basicsV2One.id);
    const back = await choose("default");
    expect(back.body.data).toMatchObject({ chosenVersionKey: "default", firstChapterSlug: "basics-one", percentComplete: 50, chaptersCompleted: 2 });
    expect((await enrollmentRow()).moduleVersions).toBeNull();
    expect(await prisma.chapterProgress.count({ where: { enrollmentId: fx.enrollment.id, status: "COMPLETED" } })).toBe(3);

    const onDefault = await read("chapter-a");
    expect(moduleTwo(onDefault.body).completedCount).toBe(1);

    const again = await choose("v2");
    expect(again.body.data).toMatchObject({ percentComplete: 67, chaptersCompleted: 2 });
    const onV2 = await read("chapter-a");
    expect(moduleTwo(onV2.body).completedCount).toBe(1);
    expect(moduleTwo(onV2.body).chapters).toHaveLength(1);
  });

  it("refuses an unknown version or module with the usual error shape", async () => {
    const version = await choose("v9");
    expect(version.status).toBe(404);
    expect(version.body).toMatchObject({ success: false, code: "MODULE_VERSION_NOT_FOUND" });
    const module = await choose("v2", "no-such-module");
    expect(module.status).toBe(404);
    expect(module.body.code).toBe("MODULE_NOT_FOUND");
    const single = await choose("v2", fx.module1.id);
    expect(single.status).toBe(404);
    expect(single.body.code).toBe("MODULE_HAS_NO_VERSIONS");
    const empty = await request(app).put(`${base()}/modules/m2/version`).set(learner()).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe("VALIDATION_ERROR");
    expect((await enrollmentRow()).moduleVersions).toBeNull();
  });

  it("refuses a user who is not enrolled", async () => {
    const auth = { Authorization: `Bearer ${outsiderToken}` };
    expect((await request(app).get(`${base()}/module-versions`).set(auth)).status).toBe(403);
    expect((await choose("v2", "m2", auth)).status).toBe(403);
    expect((await request(app).put(`${base()}/modules/m2/version-feedback`).set(auth).send({ versionKey: "v2" })).status).toBe(403);
    expect((await request(app).get(`${base()}/module-versions`)).status).toBe(401);
  });

  it("lets the choice change after the course variant is locked", async () => {
    await prisma.enrollment.update({ where: { id: fx.enrollment.id }, data: { variantLockedAt: new Date() } });
    try {
      expect((await choose("v2")).status).toBe(200);
    } finally {
      await prisma.enrollment.update({ where: { id: fx.enrollment.id }, data: { variantLockedAt: null } });
    }
  });
});

describe("module version feedback", () => {
  beforeAll(resetLearner);
  const feedback = () => `${base()}/modules/m2/version-feedback`;

  it("sets, changes and deletes one vote per module", async () => {
    const first = await request(app).put(feedback()).set(learner()).send({ versionKey: "v2", note: "  Shorter and clearer.  " });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ moduleKey: "m2", feedback: { versionKey: "v2", note: "Shorter and clearer." } });

    const changed = await request(app).put(feedback()).set(learner()).send({ versionKey: "default" });
    expect(changed.body.data.feedback).toMatchObject({ versionKey: "default", note: null });
    expect(await prisma.moduleVersionFeedback.count({ where: { enrollmentId: fx.enrollment.id } })).toBe(1);

    const listed = await request(app).get(`${base()}/module-versions`).set(learner());
    expect(listed.body.data.modules[0].feedback).toMatchObject({ versionKey: "default", note: null });

    const removed = await request(app).delete(feedback()).set(learner());
    expect(removed.status).toBe(200);
    expect(removed.body.data.feedback).toBeNull();
    expect(await prisma.moduleVersionFeedback.count({ where: { enrollmentId: fx.enrollment.id } })).toBe(0);
  });

  it("rejects an unknown version and a note over 2,000 characters", async () => {
    expect((await request(app).put(feedback()).set(learner()).send({ versionKey: "v9" })).body.code).toBe("MODULE_VERSION_NOT_FOUND");
    const long = await request(app).put(feedback()).set(learner()).send({ versionKey: "v2", note: "x".repeat(2001) });
    expect(long.status).toBe(400);
    expect(long.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("module versions elsewhere", () => {
  beforeEach(resetLearner);

  it("leaves a course without versions as before", async () => {
    const auth = { Authorization: `Bearer ${plain.learnerToken}` };
    const res = await request(app).get(`/api/v1/courses/${plain.course.slug}/module-versions`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ courseSlug: plain.course.slug, modules: [] });
    const chose = await request(app).put(`/api/v1/courses/${plain.course.slug}/modules/${plain.chapterA.moduleId}/version`).set(auth).send({ versionKey: "v2" });
    expect(chose.status).toBe(404);
    const reader = await request(app).get(`/api/v1/courses/${plain.course.slug}/chapters/chapter-a`).set(auth);
    expect(reader.status).toBe(200);
    expect(reader.body.data.next.slug).toBe("chapter-b");
  });

  it("requires only the capstones in the learner's own version for a certificate", async () => {
    const settings = {} as ResolvedCertificateSettings;
    const capstoneLine = `Pass the AI capstone check in "${fx.basicsV2One.title}".`;
    const onDefault = await certificateEligibility(await enrollmentRow(), settings);
    expect(onDefault.missing).not.toContain(capstoneLine);
    await choose("v2");
    const onV2 = await certificateEligibility(await enrollmentRow(), settings);
    expect(onV2.missing).toContain(capstoneLine);
  });

  it("carries the choice into a new release when the version still exists, and drops it when not", async () => {
    await choose("v2");
    const same = await prisma.courseRelease.create({ data: { courseId: fx.course.id, number: 2, content: fx.content } });
    const without = await prisma.courseRelease.create({ data: { courseId: fx.course.id, number: 3,
      content: { variants: { default: fx.content.variants.default.map(({ versions: _versions, ...module }) => module) } } } });
    try {
      expect(await prisma.$transaction(tx => upgradeEnrollmentToRelease(tx, fx.enrollment.id, same.id))).toBe(true);
      expect(await enrollmentRow()).toMatchObject({ releaseId: same.id, moduleVersions: { m2: "v2" } });
      expect(await prisma.$transaction(tx => upgradeEnrollmentToRelease(tx, fx.enrollment.id, without.id))).toBe(true);
      expect(await enrollmentRow()).toMatchObject({ releaseId: without.id, moduleVersions: null });
    } finally {
      await prisma.enrollment.update({ where: { id: fx.enrollment.id }, data: { releaseId: fx.release.id } });
      await prisma.courseRelease.deleteMany({ where: { id: { in: [same.id, without.id] } } });
    }
  });

  it("keeps a learner's completed work in another version from blocking a release upgrade", async () => {
    await completeChapter(fx.enrollment.id, fx.basicsOne.id);
    await choose("v2");
    const next = await prisma.courseRelease.create({ data: { courseId: fx.course.id, number: 4, content: fx.content } });
    try {
      expect(await prisma.$transaction(tx => upgradeEnrollmentToRelease(tx, fx.enrollment.id, next.id))).toBe(true);
      expect(await enrollmentRow()).toMatchObject({ releaseId: next.id, moduleVersions: { m2: "v2" } });
    } finally {
      await prisma.enrollment.update({ where: { id: fx.enrollment.id }, data: { releaseId: fx.release.id } });
      await prisma.courseRelease.deleteMany({ where: { id: next.id } });
    }
  });
});
