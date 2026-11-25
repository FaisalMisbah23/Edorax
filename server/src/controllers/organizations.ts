import type { Request, Response } from "express";
import * as organizations from "../services/organizations/members.js";
import { created, noContent, ok } from "../utils/responses.js";

const param = (req: Request, name: string) => req.params[name] as string;

// GET /api/v1/organizations
export async function listMine(req: Request, res: Response) {
  ok(res, await organizations.listMyOrganizations(req.user!));
}

// POST /api/v1/organizations
export async function create(req: Request, res: Response) {
  created(res, await organizations.createOrganization(req.user!, req.body));
}

// GET /api/v1/organizations/:organizationId
export async function show(req: Request, res: Response) {
  ok(res, await organizations.loadOrganization(req.user!, param(req, "organizationId")));
}

// PATCH /api/v1/organizations/:organizationId
export async function rename(req: Request, res: Response) {
  ok(res, await organizations.renameOrganization(req.user!, param(req, "organizationId"), req.body.name));
}

// PATCH /api/v1/organizations/:organizationId/members/:userId
export async function changeRole(req: Request, res: Response) {
  ok(res, await organizations.changeMemberRole(req.user!, param(req, "organizationId"), param(req, "userId"), req.body.role));
}

// DELETE /api/v1/organizations/:organizationId/members/:userId (an admin removing someone, or a member leaving)
export async function removeMember(req: Request, res: Response) {
  await organizations.removeMember(req.user!, param(req, "organizationId"), param(req, "userId"));
  noContent(res);
}

// POST /api/v1/organizations/:organizationId/invites
export async function createInvite(req: Request, res: Response) {
  created(res, await organizations.createInvite(req.user!, param(req, "organizationId"), req.body));
}

// DELETE /api/v1/organizations/:organizationId/invites/:inviteId
export async function revokeInvite(req: Request, res: Response) {
  await organizations.revokeInvite(req.user!, param(req, "organizationId"), param(req, "inviteId"));
  noContent(res);
}

// GET /api/v1/organizations/invites/:token (public)
export async function previewInvite(req: Request, res: Response) {
  ok(res, await organizations.getInvitePreview(param(req, "token")));
}

// POST /api/v1/organizations/invites/:token/accept
export async function acceptInvite(req: Request, res: Response) {
  ok(res, await organizations.acceptInvite(req.user!, param(req, "token")));
}
