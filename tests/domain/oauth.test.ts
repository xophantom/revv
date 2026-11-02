import { describe, it, expect } from "vitest";
import { hashToken, isS256Challenge, randomToken, s256, verifyPkce } from "@/lib/oauth/crypto";
import { checkAuthorizeParams, parseScopes, readAuthorizeParams } from "@/lib/oauth/params";
import { authorizationServerMetadata } from "@/lib/oauth/metadata";
import { classifyCode, classifyRefreshToken, resolveResource, shouldTouchLastUsed, tokenResponse } from "@/lib/oauth/tokens";

const ORIGIN = "https://revv.example.com";
const RESOURCE = `${ORIGIN}/api/mcp`;
// RFC 7636 Appendix B.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("PKCE", () => {
  it("computes S256 as in RFC 7636", () => {
    expect(s256(VERIFIER)).toBe(CHALLENGE);
    expect(isS256Challenge(CHALLENGE)).toBe(true);
  });
  it("verifies the verifier against the challenge", () => {
    expect(verifyPkce(VERIFIER, CHALLENGE)).toBe(true);
    expect(verifyPkce(`${VERIFIER.slice(0, -1)}Y`, CHALLENGE)).toBe(false);
    expect(verifyPkce(undefined, CHALLENGE)).toBe(false);
    // plain (verifier === challenge) never passes
    expect(verifyPkce(CHALLENGE, CHALLENGE)).toBe(false);
  });
  it("rejects malformed verifiers and challenges", () => {
    expect(verifyPkce("short", s256("short"))).toBe(false);
    expect(verifyPkce("a".repeat(129), s256("a".repeat(129)))).toBe(false);
    expect(verifyPkce(`${"a".repeat(42)} `, s256(`${"a".repeat(42)} `))).toBe(false);
    expect(isS256Challenge(`${CHALLENGE}=`)).toBe(false);
    expect(isS256Challenge("abc")).toBe(false);
  });
});

describe("tokens at rest", () => {
  it("are random, prefixed and stored as SHA-256", () => {
    const a = randomToken("revv_at_");
    expect(a).toMatch(/^revv_at_[A-Za-z0-9_-]{43}$/);
    expect(randomToken("revv_at_")).not.toBe(a);
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("scopes", () => {
  it("defaults to revv and always includes it", () => {
    expect(parseScopes(undefined)).toEqual({ ok: true, scopes: ["revv"] });
    expect(parseScopes("")).toEqual({ ok: true, scopes: ["revv"] });
    expect(parseScopes("offline_access")).toEqual({ ok: true, scopes: ["revv", "offline_access"] });
    expect(parseScopes("offline_access  revv revv")).toEqual({ ok: true, scopes: ["revv", "offline_access"] });
  });
  it("rejects unsupported scopes", () => {
    expect(parseScopes("revv admin")).toEqual({ ok: false, invalid: ["admin"] });
  });
});

describe("authorize parameters", () => {
  const valid = {
    response_type: "code",
    client_id: "https://claude.ai/oauth/claude-code-client-metadata",
    redirect_uri: "http://localhost:3118/callback",
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    scope: "revv offline_access",
    state: "xyz",
    resource: RESOURCE,
  };

  it("accepts Claude's request", () => {
    expect(checkAuthorizeParams(valid, ORIGIN)).toEqual({
      ok: true,
      request: { clientId: valid.client_id, redirectUri: valid.redirect_uri, codeChallenge: CHALLENGE, scopes: ["revv", "offline_access"], state: "xyz", resource: RESOURCE },
    });
    const res = checkAuthorizeParams({ ...valid, resource: undefined, state: undefined, scope: undefined }, ORIGIN);
    expect(res.ok && res.request).toMatchObject({ scopes: ["revv"], state: null, resource: null });
  });
  it("maps each problem to its RFC error code", () => {
    const err = (overrides: Record<string, string | undefined>) => {
      const res = checkAuthorizeParams({ ...valid, ...overrides }, ORIGIN);
      return res.ok ? null : res.error;
    };
    expect(err({ response_type: "token" })).toBe("unsupported_response_type");
    expect(err({ response_type: undefined })).toBe("unsupported_response_type");
    expect(err({ code_challenge: undefined })).toBe("invalid_request");
    expect(err({ code_challenge_method: "plain" })).toBe("invalid_request");
    expect(err({ code_challenge_method: undefined })).toBe("invalid_request");
    expect(err({ code_challenge: "too-short" })).toBe("invalid_request");
    expect(err({ scope: "revv write:all" })).toBe("invalid_scope");
    expect(err({ resource: "https://other.example.com/api/mcp" })).toBe("invalid_target");
    expect(err({ resource: `${RESOURCE}/` })).toBe("invalid_target");
  });
  it("refuses repeated parameters", () => {
    const { params, repeated } = readAuthorizeParams({ ...valid, scope: ["revv", "offline_access"], extra: "ignored" });
    expect(repeated).toEqual(["scope"]);
    expect(params).not.toHaveProperty("scope");
    expect(params).not.toHaveProperty("extra");
    const res = checkAuthorizeParams({ ...params, client_id: valid.client_id, redirect_uri: valid.redirect_uri }, ORIGIN, repeated);
    expect(res.ok ? null : res.error).toBe("invalid_request");
  });
});

describe("authorization server metadata", () => {
  const meta = authorizationServerMetadata(ORIGIN);
  it("is what Claude needs to pick CIMD", () => {
    expect(meta.client_id_metadata_document_supported).toBe(true);
    expect(meta.token_endpoint_auth_methods_supported).toContain("none");
    expect(meta.code_challenge_methods_supported).toEqual(["S256"]);
    expect(meta.scopes_supported).toEqual(["revv", "offline_access"]);
  });
  it("derives every endpoint from the issuer", () => {
    expect(meta).toMatchObject({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/api/oauth/token`,
      registration_endpoint: `${ORIGIN}/api/oauth/register`,
      revocation_endpoint: `${ORIGIN}/api/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
    });
  });
});

describe("token lifecycle decisions", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  const later = new Date("2026-11-02T13:00:00Z");
  const earlier = new Date("2026-11-02T11:00:00Z");

  it("treats an already rotated refresh token as reuse, even if it hasn't expired", () => {
    expect(classifyRefreshToken({ rotatedAt: null, expiresAt: later }, now)).toBe("valid");
    expect(classifyRefreshToken({ rotatedAt: earlier, expiresAt: later }, now)).toBe("reused");
    // parallel refreshes from one client: a repeat within 30 s is tolerated
    expect(classifyRefreshToken({ rotatedAt: new Date(now.getTime() - 30_000), expiresAt: later }, now)).toBe("grace");
    expect(classifyRefreshToken({ rotatedAt: new Date(now.getTime() - 30_001), expiresAt: later }, now)).toBe("reused");
    expect(classifyRefreshToken({ rotatedAt: null, expiresAt: earlier }, now)).toBe("expired");
    expect(classifyRefreshToken({ rotatedAt: null, expiresAt: now }, now)).toBe("expired");
  });
  it("treats a second use of a code as a replay", () => {
    expect(classifyCode({ usedAt: null, expiresAt: later }, now)).toBe("valid");
    expect(classifyCode({ usedAt: earlier, expiresAt: later }, now)).toBe("replayed");
    expect(classifyCode({ usedAt: null, expiresAt: earlier }, now)).toBe("expired");
  });
  it("binds tokens to our MCP resource only (RFC 8707)", () => {
    expect(resolveResource(undefined, RESOURCE, ORIGIN)).toEqual({ ok: true, resource: RESOURCE });
    expect(resolveResource(undefined, null, ORIGIN)).toEqual({ ok: true, resource: null });
    expect(resolveResource(RESOURCE, null, ORIGIN)).toEqual({ ok: true, resource: RESOURCE });
    expect(resolveResource(RESOURCE, RESOURCE, ORIGIN)).toEqual({ ok: true, resource: RESOURCE });
    expect(resolveResource("https://evil.example.com/api/mcp", null, ORIGIN).ok).toBe(false);
    expect(resolveResource(RESOURCE, "https://old.example.com/api/mcp", ORIGIN).ok).toBe(false);
  });
  it("throttles the last-used write to once a minute", () => {
    expect(shouldTouchLastUsed(null, now)).toBe(true);
    expect(shouldTouchLastUsed(new Date(now.getTime() - 30_000), now)).toBe(false);
    expect(shouldTouchLastUsed(new Date(now.getTime() - 60_000), now)).toBe(true);
  });
  it("answers the token request in RFC 6749 form", () => {
    expect(tokenResponse({ accessToken: "a", refreshToken: "r", scopes: ["revv", "offline_access"] })).toEqual({
      access_token: "a",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "r",
      scope: "revv offline_access",
    });
  });
});
