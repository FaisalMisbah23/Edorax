import { isDisposable } from "@isdisposable/js";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { safeRedirectTo } from "../../shared/lib/safe-redirect.js";
import { homeRouteForRole } from "./access-rules.js";
import type { GoogleConfig, GoogleProfile } from "./google-oauth.js";
import { startSession } from "./login.js";
import { toSessionUser } from "./session.js";

// Sign in and sign up with Google. One button does both: a Google account that is already linked
// signs in, a verified Google email that matches an Edorax account links to it, and anything else
// creates a new account. Google must vouch for the email, so no confirmation email is needed.

/** The Google settings, or null when this server has no Google client configured. */
export function googleConfig(): GoogleConfig | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: `${env.APP_URL}/api/v1/auth/google/callback` };
}

export type GoogleSignInResult =
  | { ok: true; session: { sessionToken: string; expires: Date }; redirectTo: string }
  | { ok: false; reason: "unverified" | "disposable" | "suspended" | "mfa" };

export async function signInWithGoogle(profile: GoogleProfile, redirectTo?: string): Promise<GoogleSignInResult> {
  if (!profile.emailVerified) return { ok: false, reason: "unverified" };

  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.sub } },
    include: { user: true },
  });

  let record = linked?.user ?? null;
  if (!record) {
    if (isDisposable(profile.email)) return { ok: false, reason: "disposable" };
    const account = { type: "oidc", provider: "google", providerAccountId: profile.sub };
    const existing = await prisma.user.findUnique({ where: { email: profile.email } });

    if (existing) {
      // Google does not ask for the authenticator code, so an account with MFA never links by email.
      if (existing.totpEnabledAt) return { ok: false, reason: "mfa" };
      record = await prisma.user.update({
        where: { id: existing.id },
        data: {
          emailVerified: existing.emailVerified ?? new Date(),
          name: existing.name ?? profile.name,
          image: existing.image ?? profile.picture,
          // A password set before the email was ever confirmed may belong to someone else, so it goes.
          ...(existing.emailVerified ? {} : { passwordHash: null }),
          accounts: { create: account },
        },
      });
    } else {
      record = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          emailVerified: new Date(),
          role: "MENTEE",
          profile: { create: { timezone: "UTC", skills: [] } },
          accounts: { create: account },
        },
      });
    }
  }

  if (record.suspendedAt) return { ok: false, reason: "suspended" };
  if (record.totpEnabledAt) return { ok: false, reason: "mfa" };

  const { user, session } = await startSession(toSessionUser(record));
  return { ok: true, session, redirectTo: safeRedirectTo(redirectTo) ?? homeRouteForRole(user.role) };
}
