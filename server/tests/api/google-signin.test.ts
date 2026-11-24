import { beforeEach, describe, expect, it, vi } from "vitest";

// The database and the session are mocked: these tests are about who may sign in and what is linked.
const prisma = vi.hoisted(() => ({
  account: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock("../../src/db/prisma.js", () => ({ prisma }));
vi.mock("../../src/config/env.js", () => ({ env: { APP_URL: "https://edorax.test", GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" } }));
vi.mock("../../src/services/auth/login.js", () => ({
  startSession: vi.fn(async (user: { id: string; role: string }) => ({ user, session: { sessionToken: `session-${user.id}`, expires: new Date(2030, 0, 1) } })),
}));

import { googleConfig, signInWithGoogle } from "../../src/services/auth/google.js";
import type { GoogleProfile } from "../../src/services/auth/google-oauth.js";

const profile: GoogleProfile = { sub: "sub-1", email: "learner@gmail.com", emailVerified: true, name: "Learner", picture: "https://img.example/p.png" };
const baseUser = {
  id: "user-1",
  email: "learner@gmail.com",
  name: null,
  image: null,
  role: "MENTEE",
  emailVerified: new Date(2026, 0, 1),
  passwordHash: "hash",
  totpEnabledAt: null,
  suspendedAt: null,
  testerEnabled: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.account.findUnique.mockResolvedValue(null);
  prisma.user.findUnique.mockResolvedValue(null);
  prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...baseUser, ...data, id: "new-user", passwordHash: null }));
  prisma.user.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...baseUser, ...data }));
});

describe("googleConfig", () => {
  it("uses the web app address for the redirect", () => {
    expect(googleConfig()).toEqual({ clientId: "id", clientSecret: "secret", redirectUri: "https://edorax.test/api/v1/auth/google/callback" });
  });
});

describe("signInWithGoogle", () => {
  it("refuses an email Google did not verify, without touching the database", async () => {
    expect(await signInWithGoogle({ ...profile, emailVerified: false })).toEqual({ ok: false, reason: "unverified" });
    expect(prisma.account.findUnique).not.toHaveBeenCalled();
  });

  it("creates a verified account for a new email and links Google to it", async () => {
    const result = await signInWithGoogle(profile, "/courses/linux");
    expect(result).toMatchObject({ ok: true, redirectTo: "/courses/linux", session: { sessionToken: "session-new-user" } });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ email: "learner@gmail.com", name: "Learner", role: "MENTEE", accounts: { create: { provider: "google", providerAccountId: "sub-1" } } });
    expect(data.emailVerified).toBeInstanceOf(Date);
    expect(data.passwordHash).toBeUndefined();
  });

  it("signs in a Google account that is already linked", async () => {
    prisma.account.findUnique.mockResolvedValue({ user: baseUser });
    expect(await signInWithGoogle(profile)).toMatchObject({ ok: true });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("links a verified Google email to the account that has it, and keeps its password", async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);
    expect(await signInWithGoogle(profile)).toMatchObject({ ok: true });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: "Learner", image: "https://img.example/p.png", accounts: { create: { provider: "google", providerAccountId: "sub-1" } } });
    expect(data).not.toHaveProperty("passwordHash");
  });

  it("removes a password set before the email was ever confirmed", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, emailVerified: null });
    expect(await signInWithGoogle(profile)).toMatchObject({ ok: true });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.passwordHash).toBeNull();
    expect(data.emailVerified).toBeInstanceOf(Date);
  });

  it("never links an account that has two-step sign-in turned on", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, totpEnabledAt: new Date() });
    expect(await signInWithGoogle(profile)).toEqual({ ok: false, reason: "mfa" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("does not sign in a linked account that later turned two-step sign-in on", async () => {
    prisma.account.findUnique.mockResolvedValue({ user: { ...baseUser, totpEnabledAt: new Date() } });
    expect(await signInWithGoogle(profile)).toEqual({ ok: false, reason: "mfa" });
  });

  it("refuses a suspended account", async () => {
    prisma.account.findUnique.mockResolvedValue({ user: { ...baseUser, suspendedAt: new Date() } });
    expect(await signInWithGoogle(profile)).toEqual({ ok: false, reason: "suspended" });
  });

  it("refuses a throwaway email address for a new account", async () => {
    expect(await signInWithGoogle({ ...profile, email: "someone@mailinator.com" })).toEqual({ ok: false, reason: "disposable" });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("ignores a redirect that leaves the site", async () => {
    expect(await signInWithGoogle(profile, "//evil.example")).toMatchObject({ ok: true, redirectTo: expect.stringMatching(/^\/(?!\/)/) });
  });
});
