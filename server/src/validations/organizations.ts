import { z } from "zod";
import { email, id, params } from "./common.js";

const name = z.string().trim().min(2, "Give the organisation a name.").max(120);
const role = z.enum(["ADMIN", "TEACHER"]);

export const organizationIdParams = params("organizationId");
export const organizationMemberParams = z.object({ organizationId: id, userId: id });
export const organizationInviteParams = z.object({ organizationId: id, inviteId: id });
export const organizationInviteTokenParams = z.object({ token: z.string().trim().min(16).max(64) });

export const createOrganizationBody = z.object({ name });
export const renameOrganizationBody = z.object({ name });
export const changeMemberRoleBody = z.object({ role });
/** No email makes an open link: anyone who opens it first can use it. */
export const createOrganizationInviteBody = z.object({ role, email: email.nullable().optional() });
