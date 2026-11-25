import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { createSession } from "../../src/services/auth/session.js";
import { createCourseFixture } from "../helpers/fixtures.js";

// Organisations people run themselves: an ordinary account creates one, invites
// teachers, and the teachers run classes without the platform instructor role.

const app = createApp();
let fx: Awaited<ReturnType<typeof createCourseFixture>>;
const users: Record<"owner" | "teacher" | "second" | "stranger", { id: string; email: string; token: string }> = {} as never;
let orgId = "";
let classId = "";
let joinCode = "";
let openInviteUrl = "";
const extraOrgIds: string[] = [];

const as = (who: keyof typeof users) => ({ Authorization: `Bearer ${users[who].token}` });
const tokenOf = (url: string) => url.split("/org-invite/")[1]!;

beforeAll(async () => {
  fx = await createCourseFixture();
  for (const who of ["owner", "teacher", "second", "stranger"] as const) {
    const user = await prisma.user.create({
      data: { email: `${who}-${fx.tag}@test.local`, name: `The ${who}`, role: "MENTEE", emailVerified: new Date() },
    });
    users[who] = { id: user.id, email: user.email!, token: (await createSession(user.id)).sessionToken };
  }
});

afterAll(async () => {
  const ids = [orgId, ...extraOrgIds].filter(Boolean);
  await prisma.teachingClass.deleteMany({ where: { organizationId: { in: ids } } });
  await prisma.organization.deleteMany({ where: { id: { in: ids } } });
  const userIds = Object.values(users).map((user) => user.id);
  await prisma.enrollment.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await fx.cleanup();
});

describe("creating an organisation", () => {
  it("lets an ordinary account create one and become its admin", async () => {
    const res = await request(app).post("/api/v1/organizations").set(as("owner")).send({ name: "Lahore Code Academy" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "Lahore Code Academy", viewerRole: "ADMIN", stats: { teachers: 1, classes: 0, learners: 0 } });
    orgId = res.body.data.id;

    const mine = await request(app).get("/api/v1/organizations").set(as("owner"));
    expect(mine.body.data.organizations).toEqual([expect.objectContaining({ id: orgId, role: "ADMIN", memberCount: 1 })]);
    expect(mine.body.data.canCreate).toBe(2);

    // A self-made organisation gets no API credentials and no credits.
    const row = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, include: { apiCredentials: true } });
    expect(row).toMatchObject({ createdById: users.owner.id, creditBalance: 0 });
    expect(row.apiCredentials).toHaveLength(0);
  });

  it("stops one account making more than three", async () => {
    for (const n of [2, 3]) {
      const res = await request(app).post("/api/v1/organizations").set(as("owner")).send({ name: `Spare ${n}` });
      expect(res.status).toBe(201);
      extraOrgIds.push(res.body.data.id);
    }
    const fourth = await request(app).post("/api/v1/organizations").set(as("owner")).send({ name: "One too many" });
    expect(fourth.status).toBe(409);
    expect(fourth.body.code).toBe("ORGANIZATION_LIMIT");
  });

  it("hides an organisation from people outside it", async () => {
    expect((await request(app).get(`/api/v1/organizations/${orgId}`).set(as("stranger"))).status).toBe(404);
    expect((await request(app).post(`/api/v1/organizations/${orgId}/invites`).set(as("stranger")).send({ role: "TEACHER" })).status).toBe(404);
    // No organisation and no instructor role: no class tools.
    expect((await request(app).get("/api/v1/teach/classes").set(as("teacher"))).status).toBe(403);
  });
});

describe("inviting teachers", () => {
  let boundToken = "";

  it("makes an invite for one address and shows it to anyone holding the link", async () => {
    const res = await request(app).post(`/api/v1/organizations/${orgId}/invites`).set(as("owner")).send({ role: "TEACHER", email: users.teacher.email.toUpperCase() });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ role: "TEACHER", email: users.teacher.email });
    boundToken = tokenOf(res.body.data.url);

    const preview = await request(app).get(`/api/v1/organizations/invites/${boundToken}`);
    expect(preview.status).toBe(200);
    expect(preview.body.data).toMatchObject({ state: "valid", role: "TEACHER", email: users.teacher.email, organization: { id: orgId, name: "Lahore Code Academy" }, invitedByName: "The owner" });

    const detail = await request(app).get(`/api/v1/organizations/${orgId}`).set(as("owner"));
    expect(detail.body.data.invites).toHaveLength(1);
  });

  it("refuses the wrong account, then accepts once for the right one", async () => {
    const wrong = await request(app).post(`/api/v1/organizations/invites/${boundToken}/accept`).set(as("stranger"));
    expect(wrong.status).toBe(403);
    expect(wrong.body.code).toBe("WRONG_ACCOUNT");

    const ok = await request(app).post(`/api/v1/organizations/invites/${boundToken}/accept`).set(as("teacher"));
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual({ organizationId: orgId, role: "TEACHER" });

    const again = await request(app).post(`/api/v1/organizations/invites/${boundToken}/accept`).set(as("teacher"));
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("INVITE_ACCEPTED");
    expect((await request(app).get(`/api/v1/organizations/invites/${boundToken}`)).body.data.state).toBe("accepted");
  });

  it("lets an open link be used by whoever opens it first", async () => {
    const res = await request(app).post(`/api/v1/organizations/${orgId}/invites`).set(as("owner")).send({ role: "TEACHER" });
    openInviteUrl = res.body.data.url;
    expect(res.body.data.email).toBeNull();
    const accepted = await request(app).post(`/api/v1/organizations/invites/${tokenOf(openInviteUrl)}/accept`).set(as("second"));
    expect(accepted.status).toBe(200);
  });

  it("cancels an invite and reports an expired one", async () => {
    const made = await request(app).post(`/api/v1/organizations/${orgId}/invites`).set(as("owner")).send({ role: "ADMIN" });
    expect((await request(app).delete(`/api/v1/organizations/${orgId}/invites/${made.body.data.id}`).set(as("owner"))).status).toBe(204);
    const revoked = await request(app).post(`/api/v1/organizations/invites/${tokenOf(made.body.data.url)}/accept`).set(as("stranger"));
    expect(revoked.body.code).toBe("INVITE_REVOKED");

    const old = await request(app).post(`/api/v1/organizations/${orgId}/invites`).set(as("owner")).send({ role: "TEACHER" });
    await prisma.organizationInvite.update({ where: { id: old.body.data.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await request(app).post(`/api/v1/organizations/invites/${tokenOf(old.body.data.url)}/accept`).set(as("stranger"));
    expect(expired.body.code).toBe("INVITE_EXPIRED");
  });

  it("keeps invites and roles in the admin's hands", async () => {
    expect((await request(app).post(`/api/v1/organizations/${orgId}/invites`).set(as("teacher")).send({ role: "TEACHER" })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/organizations/${orgId}/members/${users.teacher.id}`).set(as("teacher")).send({ role: "ADMIN" })).status).toBe(403);
    // Teachers do not see open invite links.
    expect((await request(app).get(`/api/v1/organizations/${orgId}`).set(as("teacher"))).body.data.invites).toEqual([]);
  });
});

describe("organisation teachers run classes", () => {
  it("lets a teacher without the instructor role create a class, but only inside the organisation", async () => {
    const own = await request(app).post("/api/v1/teach/classes").set(as("teacher")).send({ name: "Own class", courseIds: [fx.course.id] });
    expect(own.status).toBe(403);
    expect(own.body.code).toBe("ORGANIZATION_REQUIRED");

    const outside = await request(app).post("/api/v1/teach/classes").set(as("teacher")).send({ name: "Elsewhere", courseIds: [fx.course.id], organizationId: extraOrgIds[0] });
    expect(outside.status).toBe(404);

    const res = await request(app).post("/api/v1/teach/classes").set(as("teacher")).send({ name: "Evening batch", courseIds: [fx.course.id], organizationId: orgId });
    expect(res.status).toBe(201);
    expect(res.body.data.organization).toEqual({ id: orgId, name: "Lahore Code Academy" });
    classId = res.body.data.id;
    joinCode = res.body.data.joinCode;
  });

  it("never grants the platform instructor role", async () => {
    expect((await prisma.user.findUniqueOrThrow({ where: { id: users.teacher.id } })).role).toBe("MENTEE");
    expect((await request(app).get("/api/v1/teach/courses").set(as("teacher"))).status).toBe(403);
  });

  it("shows the admin every class, learners and activity", async () => {
    expect((await request(app).post(`/api/v1/classes/join/${joinCode}`).set({ Authorization: `Bearer ${fx.learnerToken}` })).status).toBe(200);
    await prisma.enrollment.update({ where: { id: fx.enrollment.id }, data: { lastActiveAt: new Date() } });

    const res = await request(app).get(`/api/v1/organizations/${orgId}`).set(as("owner"));
    expect(res.status).toBe(200);
    expect(res.body.data.stats).toEqual({ teachers: 3, classes: 1, learners: 1, activeLearners7d: 1 });
    expect(res.body.data.classes).toEqual([expect.objectContaining({ id: classId, name: "Evening batch", memberCount: 1, canOpen: true, teacher: { id: users.teacher.id, name: "The teacher" } })]);
    expect(res.body.data.members.find((member: { userId: string }) => member.userId === users.teacher.id)).toMatchObject({ role: "TEACHER", classCount: 1 });

    expect((await request(app).get(`/api/v1/teach/classes/${classId}/gradebook`).set(as("owner"))).status).toBe(200);
    expect((await request(app).get(`/api/v1/teach/classes/${classId}/gradebook`).set(as("teacher"))).status).toBe(200);
  });

  it("keeps one teacher's class closed to another teacher", async () => {
    const view = await request(app).get(`/api/v1/organizations/${orgId}`).set(as("second"));
    expect(view.body.data.classes[0]).toMatchObject({ id: classId, canOpen: false });
    expect((await request(app).get(`/api/v1/teach/classes/${classId}`).set(as("second"))).status).toBe(404);
    expect((await request(app).get(`/api/v1/teach/classes/${classId}/gradebook/export`).set(as("second"))).status).toBe(404);
  });
});

describe("changing who is in the organisation", () => {
  it("never leaves an organisation without an admin", async () => {
    const demote = await request(app).patch(`/api/v1/organizations/${orgId}/members/${users.owner.id}`).set(as("owner")).send({ role: "TEACHER" });
    expect(demote.status).toBe(409);
    expect(demote.body.code).toBe("LAST_ADMIN");
    const leave = await request(app).delete(`/api/v1/organizations/${orgId}/members/${users.owner.id}`).set(as("owner"));
    expect(leave.body.code).toBe("LAST_ADMIN");

    const promote = await request(app).patch(`/api/v1/organizations/${orgId}/members/${users.second.id}`).set(as("owner")).send({ role: "ADMIN" });
    expect(promote.status).toBe(200);
    expect(promote.body.data.members.find((member: { userId: string }) => member.userId === users.second.id).role).toBe("ADMIN");
  });

  it("takes a removed teacher's classes away from them and leaves them with the organisation", async () => {
    expect((await request(app).delete(`/api/v1/organizations/${orgId}/members/${users.teacher.id}`).set(as("owner"))).status).toBe(204);
    expect((await request(app).get(`/api/v1/teach/classes/${classId}`).set(as("teacher"))).status).toBe(403);
    expect((await request(app).get(`/api/v1/organizations/${orgId}`).set(as("teacher"))).status).toBe(404);
    // The new admin can open it, and the learner is still in it.
    const kept = await request(app).get(`/api/v1/teach/classes/${classId}`).set(as("second"));
    expect(kept.status).toBe(200);
    expect(kept.body.data.memberCount).toBe(1);
  });

  it("lets a member leave on their own", async () => {
    expect((await request(app).delete(`/api/v1/organizations/${orgId}/members/${users.second.id}`).set(as("second"))).status).toBe(204);
    const left = await request(app).get(`/api/v1/organizations/${orgId}`).set(as("owner"));
    expect(left.body.data.members.map((member: { userId: string }) => member.userId)).toEqual([users.owner.id]);
  });

  it("renames, for admins only", async () => {
    const res = await request(app).patch(`/api/v1/organizations/${orgId}`).set(as("owner")).send({ name: "Lahore Code School" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Lahore Code School");
  });
});
