import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  GoogleSignInError,
  authorizeUrl,
  decodeFlow,
  encodeFlow,
  exchangeCode,
  newFlow,
  readIdToken,
  type GoogleConfig,
} from "../../src/services/auth/google-oauth.js";

const config: GoogleConfig = { clientId: "client-1", clientSecret: "secret-1", redirectUri: "https://edorax.test/api/v1/auth/google/callback" };
const NOW = Date.UTC(2026, 10, 24, 12, 0, 0);

function idToken(claims: Record<string, unknown>) {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
}
const goodClaims = (extra: Record<string, unknown> = {}) => ({
  iss: "https://accounts.google.com",
  aud: "client-1",
  exp: NOW / 1000 + 600,
  nonce: "nonce-1",
  sub: "google-sub-1",
  email: "Learner@Example.com",
  email_verified: true,
  name: "  Learner One ",
  picture: "https://lh3.example/photo.png",
  ...extra,
});

describe("authorizeUrl", () => {
  it("asks for the code flow with PKCE, the state and the nonce", () => {
    const flow = newFlow("/courses/x");
    const url = new URL(authorizeUrl(config, flow));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe(flow.state);
    expect(url.searchParams.get("nonce")).toBe(flow.nonce);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(flow.verifier).digest("base64url"));
    expect(url.searchParams.get("code_challenge")).not.toBe(flow.verifier);
  });

  it("makes a new random flow every time", () => {
    expect(newFlow().state).not.toBe(newFlow().state);
  });
});

describe("flow cookie", () => {
  it("round-trips", () => {
    const flow = newFlow("/learn");
    expect(decodeFlow(encodeFlow(flow))).toEqual(flow);
  });

  it("rejects a missing, broken or incomplete cookie", () => {
    expect(decodeFlow(undefined)).toBeNull();
    expect(decodeFlow("not-base64-json")).toBeNull();
    expect(decodeFlow(Buffer.from(JSON.stringify({ state: "a", verifier: "b" })).toString("base64url"))).toBeNull();
    expect(decodeFlow(Buffer.from(JSON.stringify({ state: "", verifier: "b", nonce: "c" })).toString("base64url"))).toBeNull();
  });
});

describe("readIdToken", () => {
  it("returns a clean profile", () => {
    expect(readIdToken(idToken(goodClaims()), config, "nonce-1", NOW)).toEqual({
      sub: "google-sub-1",
      email: "learner@example.com",
      emailVerified: true,
      name: "Learner One",
      picture: "https://lh3.example/photo.png",
    });
  });

  it("accepts the bare issuer and a list of audiences", () => {
    expect(() => readIdToken(idToken(goodClaims({ iss: "accounts.google.com", aud: ["other", "client-1"] })), config, "nonce-1", NOW)).not.toThrow();
  });

  it("does not trust an email Google did not verify", () => {
    expect(readIdToken(idToken(goodClaims({ email_verified: false })), config, "nonce-1", NOW).emailVerified).toBe(false);
    expect(readIdToken(idToken(goodClaims({ email_verified: undefined })), config, "nonce-1", NOW).emailVerified).toBe(false);
  });

  it.each([
    ["another issuer", { iss: "https://evil.example" }],
    ["another app", { aud: "client-2" }],
    ["an expired token", { exp: NOW / 1000 - 1 }],
    ["a wrong nonce", { nonce: "other" }],
    ["no subject", { sub: undefined }],
    ["no email", { email: undefined }],
  ])("rejects %s", (_name, extra) => {
    expect(() => readIdToken(idToken(goodClaims(extra)), config, "nonce-1", NOW)).toThrow(GoogleSignInError);
  });

  it("rejects garbage", () => {
    expect(() => readIdToken("garbage", config, "nonce-1", NOW)).toThrow(GoogleSignInError);
  });
});

describe("exchangeCode", () => {
  it("posts the code with the PKCE verifier and returns the ID token", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id_token: "the-token" }), { status: 200 }));
    expect(await exchangeCode(config, "code-1", "verifier-1", fetchMock as unknown as typeof fetch)).toBe("the-token");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toMatchObject({ code: "code-1", code_verifier: "verifier-1", client_id: "client-1", client_secret: "secret-1", grant_type: "authorization_code", redirect_uri: config.redirectUri });
  });

  it("fails when Google refuses the code", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    await expect(exchangeCode(config, "bad", "v", fetchMock as unknown as typeof fetch)).rejects.toThrow(/invalid_grant/);
  });
});
