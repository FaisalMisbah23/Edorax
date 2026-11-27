import { createHash, randomBytes } from "node:crypto";

// Sign in with Google: the OpenID Connect authorization-code flow with PKCE. Pure helpers only (no
// database), so they are easy to test. The ID token comes straight from Google's token endpoint over
// TLS, so, as the OpenID Connect spec allows, it is checked by its claims and not by its signature.

export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string };

/** What the start of the flow remembers for the callback, in a short-lived httpOnly cookie. */
export type GoogleFlow = { state: string; verifier: string; nonce: string; redirectTo?: string };

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name: string | null; picture: string | null };

export class GoogleSignInError extends Error {}

export const GOOGLE_FLOW_COOKIE = "edorax_google_oauth";
export const GOOGLE_FLOW_PATH = "/api/v1/auth/google";
export const GOOGLE_FLOW_MAX_AGE_MS = 10 * 60 * 1000;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const random = () => randomBytes(32).toString("base64url");

export function newFlow(redirectTo?: string): GoogleFlow {
  return { state: random(), verifier: random(), nonce: random(), ...(redirectTo ? { redirectTo } : {}) };
}

export function authorizeUrl(config: GoogleConfig, flow: GoogleFlow): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", flow.state);
  url.searchParams.set("nonce", flow.nonce);
  url.searchParams.set("code_challenge", createHash("sha256").update(flow.verifier).digest("base64url"));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export function encodeFlow(flow: GoogleFlow): string {
  return Buffer.from(JSON.stringify(flow)).toString("base64url");
}

/** The flow from the cookie, or null when it is missing or not in the shape we wrote. */
export function decodeFlow(raw: string | undefined): GoogleFlow | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<string, unknown>;
    const { state, verifier, nonce, redirectTo } = value;
    if (typeof state !== "string" || typeof verifier !== "string" || typeof nonce !== "string") return null;
    if (!state || !verifier || !nonce) return null;
    return { state, verifier, nonce, ...(typeof redirectTo === "string" ? { redirectTo } : {}) };
  } catch {
    return null;
  }
}

/** Trades the one-time code for an ID token. */
export async function exchangeCode(config: GoogleConfig, code: string, verifier: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const body = (await response.json().catch(() => null)) as { id_token?: unknown; error?: unknown } | null;
  if (!response.ok || !body || typeof body.id_token !== "string") {
    throw new GoogleSignInError(`Google token exchange failed (${response.status}${typeof body?.error === "string" ? `: ${body.error}` : ""})`);
  }
  return body.id_token;
}

/** Checks the claims of an ID token and returns the profile in it. */
export function readIdToken(idToken: string, config: GoogleConfig, nonce: string, now: number = Date.now()): GoogleProfile {
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new GoogleSignInError("The ID token could not be read");
  }
  if (typeof claims.iss !== "string" || !ISSUERS.has(claims.iss)) throw new GoogleSignInError("The ID token has the wrong issuer");
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(config.clientId)) throw new GoogleSignInError("The ID token is for another app");
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) throw new GoogleSignInError("The ID token has expired");
  if (claims.nonce !== nonce) throw new GoogleSignInError("The ID token nonce does not match");
  if (typeof claims.sub !== "string" || !claims.sub) throw new GoogleSignInError("The ID token has no subject");
  if (typeof claims.email !== "string" || !claims.email) throw new GoogleSignInError("The ID token has no email");
  return {
    sub: claims.sub,
    email: claims.email.trim().toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : null,
    picture: typeof claims.picture === "string" && claims.picture ? claims.picture : null,
  };
}
