import { randomBytes } from "node:crypto";
import {
  ORGANIZATION_ERROR_CODES,
  type AcceptOrganizationInviteResult,
  type MyOrganizationsView,
  type OrganizationDetail,
  type OrganizationInvitePreview,
  type OrganizationInviteRow,
  type OrganizationInviteState,
  type OrganizationRole,
} from "../../shared/api/organizations.js";
import { prisma } from "../../db/prisma.js";
import { slugify } from "../../shared/lib/mdx-headings.js";
import type { SessionUser } from "../../types/auth.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { appBaseUrl } from "../email/send.js";

// Organisations people run themselves. The creator becomes an ADMIN; admins invite
// teachers with single-use links. Membership never changes a person's platform role:
// an organisation teacher may run classes for the organisation, and nothing else that
// the instructor role allows (publishing to the catalog, selling courses, payouts).
// API credentials, credits and free course access stay with platform admins.

/** Self-made organisations per person, so one account cannot fill the table. */
export const ORGANIZATION_CREATE_LIMIT = 3;
const INVITE_DAYS = 14;
const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const iso = (value: Date | null) => value?.toISOString() ?? null;

export function organizationInviteUrl(token: string): string {
  return `${appBaseUrl()}/org-invite/${token}`;
}

/** The viewer's membership, or 404 when they are not in it: an organisation's existence is not their business. */
export async function requireMembership(user: SessionUser, organizationId: string) {
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
    select: { role: true },
  });
  if (!member) throw new NotFoundError("Organisation not found");
  return member;
}

export async function requireOrganizationAdmin(user: SessionUser, organizationId: string) {
  const member = await requireMembership(user, organizationId);
  if (member.role !== "ADMIN") throw new ForbiddenError("Only an organisation admin can do this.", "ORGANIZATION_ADMIN_REQUIRED");
  return member;
}

/** True when the person teaches or runs at least one organisation, which opens the class tools to them. */
export async function hasOrganizationTeachingRole(userId: string): Promise<boolean> {
  return (await prisma.organizationMember.count({ where: { userId } })) > 0;
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "organisation";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${randomBytes(3).toString("hex")}`;
    if (!(await prisma.organization.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  throw new ConflictError("Could not name this organisation. Try another name.");
}

// ─── Mine ────────────────────────────────────────────────────────────────────

export async function listMyOrganizations(user: SessionUser): Promise<MyOrganizationsView> {
  const [memberships, created] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        organization: { select: { id: true, name: true, _count: { select: { members: true, classes: true } } } },
      },
    }),
    prisma.organization.count({ where: { createdById: user.id } }),
  ]);
  return {
    organizations: memberships.map(({ role, organization }) => ({
      id: organization.id,
      name: organization.name,
      role,
      memberCount: organization._count.members,
      classCount: organization._count.classes,
    })),
    canCreate: Math.max(0, ORGANIZATION_CREATE_LIMIT - created),
  };
}

export async function createOrganization(user: SessionUser, input: { name: string }): Promise<OrganizationDetail> {
  const created = await prisma.organization.count({ where: { createdById: user.id } });
  if (created >= ORGANIZATION_CREATE_LIMIT) {
    throw new ConflictError(`You can create up to ${ORGANIZATION_CREATE_LIMIT} organisations.`, ORGANIZATION_ERROR_CODES.ORGANIZATION_LIMIT);
  }
  const organization = await prisma.organization.create({
    data: {
      name: input.name,
      slug: await uniqueSlug(input.name),
      createdById: user.id,
      members: { create: { userId: user.id, role: "ADMIN" } },
    },
    select: { id: true },
  });
  return loadOrganization(user, organization.id);
}

export async function renameOrganization(user: SessionUser, organizationId: string, name: string): Promise<OrganizationDetail> {
  await requireOrganizationAdmin(user, organizationId);
  await prisma.organization.update({ where: { id: organizationId }, data: { name } });
  return loadOrganization(user, organizationId);
}

// ─── One organisation ────────────────────────────────────────────────────────

export async function loadOrganization(user: SessionUser, organizationId: string, now = new Date()): Promise<OrganizationDetail> {
  const { role } = await requireMembership(user, organizationId);
  const isAdmin = role === "ADMIN";

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      members: {
        orderBy: { createdAt: "asc" },
        select: { userId: true, role: true, createdAt: true, user: { select: { name: true, email: true } } },
      },
      invites: isAdmin
        ? { where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" } }
        : false,
      classes: {
        orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
        select: {
          id: true, name: true, teacherId: true, archivedAt: true, startsAt: true, endsAt: true,
          teacher: { select: { name: true, email: true } },
          _count: { select: { members: true } },
          courses: { orderBy: { order: "asc" }, select: { course: { select: { id: true, slug: true, title: true } } } },
        },
      },
    },
  });

  // Learners and recent activity across every class the organisation runs.
  const classIds = organization.classes.map((item) => item.id);
  const [classMembers, classCourses] = classIds.length
    ? await Promise.all([
        prisma.teachingClassMember.findMany({ where: { classId: { in: classIds } }, select: { userId: true } }),
        prisma.teachingClassCourse.findMany({ where: { classId: { in: classIds } }, select: { courseId: true } }),
      ])
    : [[], []];
  const learnerIds = [...new Set(classMembers.map((item) => item.userId))];
  const courseIds = [...new Set(classCourses.map((item) => item.courseId))];
  const active = learnerIds.length && courseIds.length
    ? await prisma.enrollment.findMany({
        where: { userId: { in: learnerIds }, courseId: { in: courseIds }, lastActiveAt: { gte: new Date(now.getTime() - ACTIVE_WINDOW_MS) } },
        distinct: ["userId"],
        select: { userId: true },
      })
    : [];

  const classesByTeacher = new Map<string, number>();
  for (const item of organization.classes) classesByTeacher.set(item.teacherId, (classesByTeacher.get(item.teacherId) ?? 0) + 1);

  const invites: OrganizationInviteRow[] = (organization.invites || []).map((invite) => ({
    id: invite.id,
    role: invite.role,
    email: invite.email,
    url: organizationInviteUrl(invite.token),
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  }));

  return {
    id: organization.id,
    name: organization.name,
    viewerRole: role,
    createdAt: organization.createdAt.toISOString(),
    stats: {
      teachers: organization.members.length,
      classes: organization.classes.filter((item) => item.archivedAt === null).length,
      learners: learnerIds.length,
      activeLearners7d: active.length,
    },
    members: organization.members.map((member) => ({
      userId: member.userId,
      name: member.user.name ?? member.user.email ?? "Unnamed",
      email: member.user.email,
      role: member.role,
      joinedAt: member.createdAt.toISOString(),
      classCount: classesByTeacher.get(member.userId) ?? 0,
    })),
    invites,
    classes: organization.classes.map((item) => ({
      id: item.id,
      name: item.name,
      teacher: { id: item.teacherId, name: item.teacher.name ?? item.teacher.email ?? "Unnamed" },
      memberCount: item._count.members,
      courses: item.courses.map((entry) => entry.course),
      archived: item.archivedAt !== null,
      startsAt: iso(item.startsAt),
      endsAt: iso(item.endsAt),
      canOpen: isAdmin || item.teacherId === user.id,
    })),
  };
}

// ─── Members ─────────────────────────────────────────────────────────────────

async function assertAnotherAdminRemains(organizationId: string, leavingUserId: string) {
  const others = await prisma.organizationMember.count({ where: { organizationId, role: "ADMIN", userId: { not: leavingUserId } } });
  if (others === 0) {
    throw new ConflictError("Every organisation needs at least one admin. Make someone else an admin first.", ORGANIZATION_ERROR_CODES.LAST_ADMIN);
  }
}

export async function changeMemberRole(user: SessionUser, organizationId: string, userId: string, role: OrganizationRole): Promise<OrganizationDetail> {
  await requireOrganizationAdmin(user, organizationId);
  const member = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
  if (!member) throw new NotFoundError("That person is not in this organisation.");
  if (member.role === "ADMIN" && role !== "ADMIN") await assertAnotherAdminRemains(organizationId, userId);
  await prisma.organizationMember.update({ where: { id: member.id }, data: { role } });
  return loadOrganization(user, organizationId);
}

/**
 * An admin removes someone, or a member leaves (userId is their own). Their classes stay
 * with the organisation, where admins can still open them; the person loses access to them.
 */
export async function removeMember(user: SessionUser, organizationId: string, userId: string): Promise<void> {
  if (userId === user.id) await requireMembership(user, organizationId);
  else await requireOrganizationAdmin(user, organizationId);
  const member = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
  if (!member) throw new NotFoundError("That person is not in this organisation.");
  if (member.role === "ADMIN") await assertAnotherAdminRemains(organizationId, userId);
  await prisma.organizationMember.delete({ where: { id: member.id } });
}

// ─── Invites ─────────────────────────────────────────────────────────────────

export async function createInvite(
  user: SessionUser,
  organizationId: string,
  input: { role: OrganizationRole; email?: string | null }
): Promise<OrganizationInviteRow> {
  await requireOrganizationAdmin(user, organizationId);
  const invite = await prisma.organizationInvite.create({
    data: {
      organizationId,
      token: randomBytes(24).toString("base64url"),
      role: input.role,
      email: input.email?.toLowerCase() ?? null,
      invitedById: user.id,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return {
    id: invite.id,
    role: invite.role,
    email: invite.email,
    url: organizationInviteUrl(invite.token),
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  };
}

export async function revokeInvite(user: SessionUser, organizationId: string, inviteId: string): Promise<void> {
  await requireOrganizationAdmin(user, organizationId);
  const revoked = await prisma.organizationInvite.updateMany({
    where: { id: inviteId, organizationId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!revoked.count) throw new NotFoundError("That invite is not open.");
}

const inviteInclude = { organization: { select: { id: true, name: true } }, invitedBy: { select: { name: true } } } as const;

function inviteState(invite: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now = new Date()): OrganizationInviteState {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt <= now) return "expired";
  return "valid";
}

export async function getInvitePreview(token: string): Promise<OrganizationInvitePreview> {
  const invite = await prisma.organizationInvite.findUnique({ where: { token }, include: inviteInclude });
  if (!invite) throw new NotFoundError("This invite link does not exist.");
  return {
    state: inviteState(invite),
    organization: invite.organization,
    role: invite.role,
    email: invite.email,
    invitedByName: invite.invitedBy?.name ?? null,
  };
}

/** Uses the invite once. Someone already in the organisation keeps the higher of the two roles. */
export async function acceptInvite(user: SessionUser, token: string): Promise<AcceptOrganizationInviteResult> {
  const invite = await prisma.organizationInvite.findUnique({ where: { token } });
  if (!invite) throw new NotFoundError("This invite link does not exist.");
  const state = inviteState(invite);
  if (state === "accepted") throw new ConflictError("This invite has already been used.", ORGANIZATION_ERROR_CODES.INVITE_ACCEPTED);
  if (state === "revoked") throw new ConflictError("This invite was cancelled.", ORGANIZATION_ERROR_CODES.INVITE_REVOKED);
  if (state === "expired") throw new ConflictError("This invite has expired. Ask for a new one.", ORGANIZATION_ERROR_CODES.INVITE_EXPIRED);
  if (invite.email && invite.email !== user.email.toLowerCase()) {
    throw new ForbiddenError(`This invite is for ${invite.email}. Sign in with that address to accept it.`, ORGANIZATION_ERROR_CODES.WRONG_ACCOUNT);
  }

  return prisma.$transaction(async (tx) => {
    // Claim the invite first, so two people opening the same link cannot both use it.
    const claimed = await tx.organizationInvite.updateMany({
      where: { id: invite.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date(), acceptedById: user.id },
    });
    if (!claimed.count) throw new ConflictError("This invite has already been used.", ORGANIZATION_ERROR_CODES.INVITE_ACCEPTED);

    const existing = await tx.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: invite.organizationId, userId: user.id } },
    });
    const role: OrganizationRole = existing?.role === "ADMIN" || invite.role === "ADMIN" ? "ADMIN" : "TEACHER";
    if (existing) await tx.organizationMember.update({ where: { id: existing.id }, data: { role } });
    else await tx.organizationMember.create({ data: { organizationId: invite.organizationId, userId: user.id, role } });
    return { organizationId: invite.organizationId, role };
  });
}
