// GENERATED from server/src/shared — do not edit here. Run `pnpm sync-shared` in server/.
// Wire contract for organisations people run themselves: an academy, bootcamp or
// programme that adds its own teachers and sees every class it runs.
// Routes live under /api/v1/organizations.

export type OrganizationRole = "ADMIN" | "TEACHER";

export type MyOrganization = {
  id: string;
  name: string;
  role: OrganizationRole;
  memberCount: number;
  classCount: number;
};

export type MyOrganizationsView = {
  organizations: MyOrganization[];
  /** How many more organisations this person may create. */
  canCreate: number;
};

export type OrganizationMemberRow = {
  userId: string;
  name: string;
  email: string | null;
  role: OrganizationRole;
  joinedAt: string;
  classCount: number;
};

export type OrganizationInviteRow = {
  id: string;
  role: OrganizationRole;
  email: string | null;
  url: string;
  expiresAt: string;
  createdAt: string;
};

export type OrganizationClassRow = {
  id: string;
  name: string;
  teacher: { id: string; name: string };
  memberCount: number;
  courses: Array<{ id: string; slug: string; title: string }>;
  archived: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** True when the viewer may open the class: its teacher, or an organisation admin. */
  canOpen: boolean;
};

export type OrganizationStats = {
  teachers: number;
  classes: number;
  /** Distinct learners across the organisation's classes. */
  learners: number;
  /** Of those, how many studied a class course in the last 7 days. */
  activeLearners7d: number;
};

export type OrganizationDetail = {
  id: string;
  name: string;
  viewerRole: OrganizationRole;
  createdAt: string;
  stats: OrganizationStats;
  members: OrganizationMemberRow[];
  /** Open invites. Empty unless the viewer is an admin. */
  invites: OrganizationInviteRow[];
  classes: OrganizationClassRow[];
};

export type OrganizationInviteState = "valid" | "accepted" | "revoked" | "expired";

export type OrganizationInvitePreview = {
  state: OrganizationInviteState;
  organization: { id: string; name: string };
  role: OrganizationRole;
  /** Set when the invite is for one email address only. */
  email: string | null;
  invitedByName: string | null;
};

export type AcceptOrganizationInviteResult = { organizationId: string; role: OrganizationRole };

export const ORGANIZATION_ERROR_CODES = {
  ORGANIZATION_LIMIT: "ORGANIZATION_LIMIT",
  LAST_ADMIN: "LAST_ADMIN",
  INVITE_EXPIRED: "INVITE_EXPIRED",
  INVITE_REVOKED: "INVITE_REVOKED",
  INVITE_ACCEPTED: "INVITE_ACCEPTED",
  WRONG_ACCOUNT: "WRONG_ACCOUNT",
  ORGANIZATION_REQUIRED: "ORGANIZATION_REQUIRED",
} as const;
