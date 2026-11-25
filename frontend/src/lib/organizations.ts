import { ApiError } from "@/lib/api-client";
import { errorText } from "@/lib/classes";
import { ORGANIZATION_ERROR_CODES, type OrganizationRole } from "@/shared/api/organizations";

export const ROLE_LABEL: Record<OrganizationRole, string> = {
  ADMIN: "Admin",
  TEACHER: "Teacher",
};

const PLAIN_ERRORS: Record<string, string> = {
  [ORGANIZATION_ERROR_CODES.ORGANIZATION_LIMIT]: "You have reached the number of organisations you can create. Ask Edorax support if you need another one.",
  [ORGANIZATION_ERROR_CODES.LAST_ADMIN]: "An organisation needs at least one admin. Make someone else an admin first, then try again.",
};

/** A plain sentence for an organisation API error. */
export function organizationErrorText(error: unknown): string {
  if (error instanceof ApiError && PLAIN_ERRORS[error.code]) return PLAIN_ERRORS[error.code]!;
  return errorText(error);
}

export function organizationHref(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}`;
}

export function organizationClassHref(organizationId: string, classId: string): string {
  return `${organizationHref(organizationId)}/classes/${encodeURIComponent(classId)}`;
}

export function countLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
