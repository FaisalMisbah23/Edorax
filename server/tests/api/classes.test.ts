import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { createSession } from "../../src/services/auth/session.js";
import { createCourseFixture } from "../helpers/fixtures.js";

// Classes: a teacher creates one, learners join with its code, the teacher sets
// due dates and reads the gradebook. A second course fixture supplies a paid course
// and a teacher who must never see the first teacher's class.

const app = createApp();
let fx: Awaited<ReturnType<typeof createCourseFixture>>;
let other: Awaited<ReturnType<typeof createCourseFixture>>;
let teacherToken = "";
let otherTeacherToken = "";
let newcomer: { id: string; email: string };
let newcomerToken = "";
let classId = "";
let joinCode = "";

const teacher = () => ({ Authorization: `Bearer ${teacherToken}` });
const otherTeacher = () => ({ Authorization: `Bearer ${otherTeacherToken}` });
const learner = () => ({ Authorization: `Bearer ${fx.learnerToken}` });
const fresh = () => ({ Authorization: `Bearer ${newcomerToken}` });

beforeAll(async () => {
  fx = await createCourseFixture();
  other = await createCourseFixture();
  await prisma.course.update({ where: { id: other.course.id }, data: { pricingType: "PAID", priceCents: 1000 } });
  teacherToken = (await createSession(fx.mentor.id)).sessionToken;
  otherTeacherToken = (await createSession(other.mentor.id)).sessionToken;
  // A verified learner with no enrollment anywhere, to prove that joining enrols.
  const user = await prisma.user.create({
    data: { email: `newcomer-${fx.tag}@test.local`, name: "New Comer", role: "MENTEE", emailVerified: new Date() },
  });
  newcomer = { id: user.id, email: user.email! };
  newcomerToken = (await createSession(user.id, randomBytes(32).toString("hex"))).sessionToken;
});

afterAll(async () => {
  await prisma.teachingClass.deleteMany({ where: { teacherId: { in: [fx.mentor.id, other.mentor.id] } } });
  await prisma.session.deleteMany({ where: { userId: newcomer.id } });
  await fx.cleanup();
  await other.cleanup();
  await prisma.user.deleteMany({ where: { id: newcomer.id } });
});

describe("teacher: /api/v1/teach/classes", () => {
  it("is closed to learners", async () => {
    expect((await request(app).get("/api/v1/teach/classes").set(learner())).status).toBe(403);
    expect((await request(app).post("/api/v1/teach/classes").set(learner()).send({ name: "Nope", courseIds: [fx.course.id] })).status).toBe(403);
  });

  it("creates a class with a join code and lists it", async () => {
    const res = await request(app)
      .post("/api/v1/teach/classes")
      .set(teacher())
      .send({ name: "CS 201, section B", courseIds: [fx.course.id, other.course.id] });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "CS 201, section B", archived: false, memberCount: 0 });
    expect(res.body.data.joinCode).toMatch(/^[A-Z2-9]{8}$/);
    expect(res.body.data.joinUrl.endsWith(`/join/${res.body.data.joinCode}`)).toBe(true);
    expect(res.body.data.courses.map((course: { id: string }) => course.id)).toEqual([fx.course.id, other.course.id]);
    classId = res.body.data.id;
    joinCode = res.body.data.joinCode;

    const list = await request(app).get("/api/v1/teach/classes").set(teacher());
    expect(list.body.data.classes.map((item: { id: string }) => item.id)).toContain(classId);
    const options = await request(app).get("/api/v1/teach/classes/course-options").set(teacher());
    expect(options.body.data.courses.map((course: { id: string }) => course.id)).toEqual(expect.arrayContaining([fx.course.id, other.course.id]));
  });

  it("refuses bad input", async () => {
    const draft = await prisma.course.create({ data: { slug: `draft-${fx.tag}`, title: "Draft", status: "DRAFT", mentorId: fx.mentor.id } });
    const unpublished = await request(app).post("/api/v1/teach/classes").set(teacher()).send({ name: "Draft class", courseIds: [draft.id] });
    expect(unpublished.status).toBe(422);
    expect(unpublished.body.code).toBe("COURSE_NOT_AVAILABLE");
    await prisma.course.delete({ where: { id: draft.id } });

    const noCourse = await request(app).post("/api/v1/teach/classes").set(teacher()).send({ name: "Empty", courseIds: [] });
    expect(noCourse.status).toBe(400);
    const backwards = await request(app)
      .post("/api/v1/teach/classes")
      .set(teacher())
      .send({ name: "Backwards", courseIds: [fx.course.id], startsAt: "2027-03-01T00:00:00.000Z", endsAt: "2027-02-01T00:00:00.000Z" });
    expect(backwards.status).toBe(400);
  });

  it("hides a class from every other teacher", async () => {
    for (const path of ["", "/gradebook", "/gradebook/export"]) {
      expect((await request(app).get(`/api/v1/teach/classes/${classId}${path}`).set(otherTeacher())).status).toBe(404);
    }
    expect((await request(app).patch(`/api/v1/teach/classes/${classId}`).set(otherTeacher()).send({ name: "Mine now" })).status).toBe(404);
    expect((await request(app).post(`/api/v1/teach/classes/${classId}/rotate-code`).set(otherTeacher())).status).toBe(404);
  });
});

describe("learner: /api/v1/classes", () => {
  it("shows what a code leads to without signing in", async () => {
    const res = await request(app).get(`/api/v1/classes/join/${joinCode.toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ state: "open", class: { id: classId, name: "CS 201, section B", teacherName: "Test Mentor" } });
    expect(res.body.data.courses).toHaveLength(2);
    expect((await request(app).get("/api/v1/classes/join/ZZZZZZZZ")).status).toBe(404);
  });

  it("joins, enrolling in the free course and leaving the paid one to buy", async () => {
    expect((await request(app).post(`/api/v1/classes/join/${joinCode}`)).status).toBe(401);
    const res = await request(app).post(`/api/v1/classes/join/${joinCode}`).set(fresh());
    expect(res.status).toBe(200);
    expect(res.body.data.classId).toBe(classId);
    expect(res.body.data.courses).toEqual([
      { courseId: fx.course.id, slug: fx.course.slug, title: fx.course.title, state: "active" },
      { courseId: other.course.id, slug: other.course.slug, title: other.course.title, state: "not-enrolled" },
    ]);
    const enrollment = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId: fx.course.id, userId: newcomer.id } } });
    expect(enrollment).toMatchObject({ lifecycle: "ACTIVE" });
    expect(await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId: other.course.id, userId: newcomer.id } } })).toBeNull();

    // Joining again changes nothing, and a learner already in the course keeps their enrollment.
    expect((await request(app).post(`/api/v1/classes/join/${joinCode}`).set(fresh())).status).toBe(200);
    expect((await request(app).post(`/api/v1/classes/join/${joinCode}`).set(learner())).status).toBe(200);
    expect(await prisma.teachingClassMember.count({ where: { classId } })).toBe(2);
    expect(await prisma.enrollment.count({ where: { courseId: fx.course.id, userId: fx.learner.id } })).toBe(1);
  });

  it("stops a teacher joining their own class", async () => {
    const res = await request(app).post(`/api/v1/classes/join/${joinCode}`).set(teacher());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("OWN_CLASS");
  });
});

describe("due dates and the gradebook", () => {
  let moduleId = "";

  it("lists the roster with each learner's standing", async () => {
    const res = await request(app).get(`/api/v1/teach/classes/${classId}`).set(teacher());
    expect(res.status).toBe(200);
    expect(res.body.data.memberCount).toBe(2);
    expect(res.body.data.courses[0].modules).toHaveLength(1);
    moduleId = res.body.data.courses[0].modules[0].id;
    const row = res.body.data.members.find((member: { userId: string }) => member.userId === newcomer.id);
    expect(row).toMatchObject({ name: "New Comer", email: newcomer.email });
    expect(row.courses).toEqual([
      { courseId: fx.course.id, state: "active", percentComplete: 0, lastActiveAt: null },
      { courseId: other.course.id, state: "not-enrolled", percentComplete: 0, lastActiveAt: null },
    ]);
  });

  it("sets and clears a module's due date, and refuses a module outside the class", async () => {
    const outside = await prisma.module.create({ data: { courseId: (await prisma.course.create({ data: { slug: `outside-${fx.tag}`, title: "Outside", status: "PUBLISHED", mentorId: fx.mentor.id } })).id, title: "Elsewhere", order: 1 } });
    const refused = await request(app).put(`/api/v1/teach/classes/${classId}/due-dates`).set(teacher()).send({ items: [{ moduleId: outside.id, dueAt: "2027-01-10T00:00:00.000Z" }] });
    expect(refused.status).toBe(422);
    expect(refused.body.code).toBe("MODULE_NOT_IN_CLASS");
    await prisma.course.delete({ where: { id: outside.courseId } });

    const past = new Date(Date.now() - 86_400_000).toISOString();
    const set = await request(app).put(`/api/v1/teach/classes/${classId}/due-dates`).set(teacher()).send({ items: [{ moduleId, dueAt: past }] });
    expect(set.status).toBe(200);
    expect(set.body.data.courses[0].modules[0].dueAt).toBe(past);
  });

  it("marks each learner per module, per course, and flags late work", async () => {
    // The first learner answers the quiz in chapter A correctly; the newcomer does nothing.
    const answered = await request(app).post(`/api/v1/blocks/${fx.quizBlock.id}/respond`).set(learner()).send({ selected: ["a"] });
    expect(answered.status).toBe(200);

    const res = await request(app).get(`/api/v1/teach/classes/${classId}/gradebook`).set(teacher());
    expect(res.status).toBe(200);
    const { columns, rows } = res.body.data;
    expect(columns.map((column: { key: string }) => column.key)).toEqual([
      `m:${moduleId}`,
      `c:${fx.course.id}`,
      expect.stringMatching(/^m:/),
      `c:${other.course.id}`,
    ]);
    expect(columns[0]).toMatchObject({ kind: "module", label: "Module 1", courseId: fx.course.id });
    expect(columns[0].dueAt).not.toBeNull();

    const active = rows.find((row: { userId: string }) => row.userId === fx.learner.id);
    const moduleCell = active.cells[`m:${moduleId}`];
    expect(moduleCell.status).toBe("in-progress");
    expect(moduleCell.mark).toBe(100);
    expect(moduleCell.late).toBe(true);
    expect(active.lateCount).toBe(1);
    expect(active.cells[`c:${fx.course.id}`]).toMatchObject({ status: "in-progress" });
    // Not enrolled in the paid course: no cells for it at all.
    expect(active.cells[`c:${other.course.id}`]).toBeUndefined();

    const idle = rows.find((row: { userId: string }) => row.userId === newcomer.id);
    expect(idle.cells[`m:${moduleId}`]).toMatchObject({ status: "none", mark: null, progress: 0, late: true });
  });

  it("exports the gradebook as a spreadsheet", async () => {
    const res = await request(app).get(`/api/v1/teach/classes/${classId}/gradebook/export`).set(teacher());
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("cs-201-section-b-gradebook.csv");
    const [header, ...lines] = res.text.split("\n");
    expect(header).toContain("name,email,");
    expect(header).toContain("Module 1 (mark %)");
    expect(header).toContain("Module 1 (late)");
    expect(header!.endsWith("late items")).toBe(true);
    expect(lines).toHaveLength(2);
    expect(lines.find((line) => line.includes(fx.learner.email!))).toContain(",100,");
  });

  it("shows the learner their class and what is due", async () => {
    const res = await request(app).get("/api/v1/classes").set(fresh());
    expect(res.status).toBe(200);
    expect(res.body.data.classes).toHaveLength(1);
    const mine = res.body.data.classes[0];
    expect(mine).toMatchObject({ id: classId, name: "CS 201, section B", teacherName: "Test Mentor" });
    expect(mine.courses[0]).toMatchObject({ id: fx.course.id, state: "active" });
    expect(mine.courses[0].dueDates).toEqual([expect.objectContaining({ moduleId, title: "Module 1", done: false })]);
    expect(mine.courses[1]).toMatchObject({ id: other.course.id, state: "not-enrolled", dueDates: [] });
  });
});

describe("changing and closing a class", () => {
  it("renames, drops a course with its due dates, and removes a learner", async () => {
    const renamed = await request(app).patch(`/api/v1/teach/classes/${classId}`).set(teacher()).send({ name: "CS 201", courseIds: [other.course.id] });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data).toMatchObject({ name: "CS 201" });
    expect(renamed.body.data.courses.map((course: { id: string }) => course.id)).toEqual([other.course.id]);
    expect(await prisma.teachingClassDueDate.count({ where: { classId } })).toBe(0);

    expect((await request(app).delete(`/api/v1/teach/classes/${classId}/members/${fx.learner.id}`).set(teacher())).status).toBe(204);
    expect((await request(app).delete(`/api/v1/teach/classes/${classId}/members/${fx.learner.id}`).set(teacher())).status).toBe(404);
    // Removing a learner from a class never touches their course enrollment.
    expect(await prisma.enrollment.count({ where: { courseId: fx.course.id, userId: fx.learner.id } })).toBe(1);
  });

  it("gives a new code and retires the old one", async () => {
    const res = await request(app).post(`/api/v1/teach/classes/${classId}/rotate-code`).set(teacher());
    expect(res.status).toBe(200);
    expect(res.body.data.joinCode).not.toBe(joinCode);
    expect((await request(app).get(`/api/v1/classes/join/${joinCode}`)).status).toBe(404);
    joinCode = res.body.data.joinCode;
    expect(res.body.data.memberCount).toBe(1);
  });

  it("lets a learner leave, and closes an archived or ended class to new joins", async () => {
    expect((await request(app).post(`/api/v1/classes/${classId}/leave`).set(fresh())).status).toBe(204);
    expect((await request(app).post(`/api/v1/classes/${classId}/leave`).set(fresh())).status).toBe(404);

    await request(app).patch(`/api/v1/teach/classes/${classId}`).set(teacher()).send({ archived: true });
    const archived = await request(app).post(`/api/v1/classes/join/${joinCode}`).set(fresh());
    expect(archived.status).toBe(409);
    expect(archived.body.code).toBe("CLASS_ARCHIVED");
    expect((await request(app).get(`/api/v1/classes/join/${joinCode}`)).body.data.state).toBe("archived");

    await request(app).patch(`/api/v1/teach/classes/${classId}`).set(teacher()).send({ archived: false, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-02-01T00:00:00.000Z" });
    const ended = await request(app).post(`/api/v1/classes/join/${joinCode}`).set(fresh());
    expect(ended.status).toBe(409);
    expect(ended.body.code).toBe("CLASS_ENDED");
  });
});
