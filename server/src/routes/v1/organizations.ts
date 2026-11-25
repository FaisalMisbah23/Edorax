import { Router } from "express";
import * as organizations from "../../controllers/organizations.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireVerified } from "../../middlewares/require-verified.js";
import { validate, validateBody, validateParams } from "../../middlewares/validate.js";
import {
  changeMemberRoleBody,
  createOrganizationBody,
  createOrganizationInviteBody,
  organizationIdParams,
  organizationInviteParams,
  organizationInviteTokenParams,
  organizationMemberParams,
  renameOrganizationBody,
} from "../../validations/organizations.js";

// Organisations people run themselves. Platform admins manage every organisation
// (credentials, credits, free access) under /admin/organizations.
const router = Router();

// Invite links come first, so "invites" is never read as an organisation id.
router.get("/invites/:token", validateParams(organizationInviteTokenParams), organizations.previewInvite);
router.post("/invites/:token/accept", authenticate, requireVerified, validateParams(organizationInviteTokenParams), organizations.acceptInvite);

router.use(authenticate, requireVerified);
router.get("/", organizations.listMine);
router.post("/", validateBody(createOrganizationBody), organizations.create);
router.get("/:organizationId", validateParams(organizationIdParams), organizations.show);
router.patch("/:organizationId", validate({ params: organizationIdParams, body: renameOrganizationBody }), organizations.rename);
router.patch("/:organizationId/members/:userId", validate({ params: organizationMemberParams, body: changeMemberRoleBody }), organizations.changeRole);
router.delete("/:organizationId/members/:userId", validateParams(organizationMemberParams), organizations.removeMember);
router.post("/:organizationId/invites", validate({ params: organizationIdParams, body: createOrganizationInviteBody }), organizations.createInvite);
router.delete("/:organizationId/invites/:inviteId", validateParams(organizationInviteParams), organizations.revokeInvite);

export default router;
