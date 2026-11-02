import { describe, it, expect } from "vitest";
import { buildRedirect, isLoopbackRedirect, isValidRedirectUri, matchRedirectUri, redirectHost, safeCallbackPath } from "@/lib/oauth/redirect";

// What Claude Code's Client ID Metadata Document registers.
const CLAUDE_CODE = ["http://localhost/callback", "http://127.0.0.1/callback"];
const CLAUDE_WEB = ["https://claude.ai/api/mcp/auth_callback"];

describe("redirect URI validation", () => {
  it("accepts https anywhere and http only on loopback", () => {
    expect(isValidRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isValidRedirectUri("http://localhost:3118/callback")).toBe(true);
    expect(isValidRedirectUri("http://127.0.0.1/callback")).toBe(true);
    expect(isValidRedirectUri("http://[::1]:9000/cb")).toBe(true);
    expect(isValidRedirectUri("http://example.com/callback")).toBe(false);
    expect(isValidRedirectUri("http://localhost.evil.com/callback")).toBe(false);
    expect(isValidRedirectUri("cursor://callback")).toBe(false);
    expect(isValidRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isValidRedirectUri("not a url")).toBe(false);
  });
  it("rejects fragments, credentials and huge values", () => {
    expect(isValidRedirectUri("https://claude.ai/cb#x")).toBe(false);
    expect(isValidRedirectUri("https://claude.ai/cb#")).toBe(false);
    expect(isValidRedirectUri("http://127.0.0.1@evil.com/cb")).toBe(false);
    expect(isValidRedirectUri("https://user:pass@claude.ai/cb")).toBe(false);
    expect(isValidRedirectUri(`https://claude.ai/${"a".repeat(2000)}`)).toBe(false);
  });
  it("knows a loopback redirect", () => {
    expect(isLoopbackRedirect("http://localhost:3118/callback")).toBe(true);
    expect(isLoopbackRedirect("https://localhost/callback")).toBe(false);
    expect(isLoopbackRedirect("https://claude.ai/api/mcp/auth_callback")).toBe(false);
  });
});

describe("redirect URI matching", () => {
  it("matches the hosted Claude callback exactly", () => {
    expect(matchRedirectUri(CLAUDE_WEB, "https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(matchRedirectUri(CLAUDE_WEB, "https://claude.ai/api/mcp/auth_callback/")).toBe(false);
    expect(matchRedirectUri(CLAUDE_WEB, "https://claude.ai/api/mcp/auth_callback?x=1")).toBe(false);
    expect(matchRedirectUri(CLAUDE_WEB, "https://claude.ai:8443/api/mcp/auth_callback")).toBe(false);
    expect(matchRedirectUri(CLAUDE_WEB, "https://evil.claude.ai/api/mcp/auth_callback")).toBe(false);
  });
  it("matches loopback on any port, for localhost and 127.0.0.1 (RFC 8252 §7.3)", () => {
    expect(matchRedirectUri(CLAUDE_CODE, "http://localhost:3118/callback")).toBe(true);
    expect(matchRedirectUri(CLAUDE_CODE, "http://localhost:51234/callback")).toBe(true);
    expect(matchRedirectUri(CLAUDE_CODE, "http://127.0.0.1:3118/callback")).toBe(true);
    expect(matchRedirectUri(CLAUDE_CODE, "http://localhost/callback")).toBe(true);
    // A registered port doesn't pin it either.
    expect(matchRedirectUri(["http://127.0.0.1:8080/cb"], "http://127.0.0.1:9999/cb")).toBe(true);
  });
  it("still compares host, path and query on loopback", () => {
    expect(matchRedirectUri(CLAUDE_CODE, "http://localhost:3118/other")).toBe(false);
    expect(matchRedirectUri(CLAUDE_CODE, "http://localhost:3118/callback/")).toBe(false);
    expect(matchRedirectUri(CLAUDE_CODE, "http://localhost:3118/callback?next=x")).toBe(false);
    expect(matchRedirectUri(CLAUDE_CODE, "http://[::1]:3118/callback")).toBe(false);
    expect(matchRedirectUri(["http://localhost/callback"], "http://127.0.0.1:3118/callback")).toBe(false);
    expect(matchRedirectUri(CLAUDE_CODE, "https://localhost:3118/callback")).toBe(false);
    expect(matchRedirectUri(CLAUDE_CODE, "http://127.0.0.1:3118@evil.com/callback")).toBe(false);
  });
  it("never port-matches a non-loopback URI", () => {
    expect(matchRedirectUri(["https://app.example.com/cb"], "https://app.example.com:444/cb")).toBe(false);
  });
});

describe("redirect building", () => {
  it("adds params and skips missing ones", () => {
    expect(buildRedirect("https://claude.ai/api/mcp/auth_callback", { code: "abc", state: "s 1&2", iss: "https://revv.app", missing: null }))
      .toBe("https://claude.ai/api/mcp/auth_callback?code=abc&state=s+1%262&iss=https%3A%2F%2Frevv.app");
    expect(buildRedirect("http://localhost:3118/callback", { error: "access_denied", state: undefined })).toBe("http://localhost:3118/callback?error=access_denied");
  });
  it("shows the host the user goes back to", () => {
    expect(redirectHost("https://claude.ai/api/mcp/auth_callback")).toBe("claude.ai");
    expect(redirectHost("http://localhost:3118/callback")).toBe("localhost:3118");
  });
});

describe("login callbackUrl", () => {
  it("accepts same-site paths", () => {
    expect(safeCallbackPath("/oauth/authorize?client_id=x&state=y")).toBe("/oauth/authorize?client_id=x&state=y");
    expect(safeCallbackPath("/garage")).toBe("/garage");
  });
  it("rejects anything that could leave the site", () => {
    expect(safeCallbackPath("//evil.com")).toBeNull();
    expect(safeCallbackPath("/\\evil.com")).toBeNull();
    expect(safeCallbackPath("https://evil.com")).toBeNull();
    expect(safeCallbackPath("evil.com")).toBeNull();
    expect(safeCallbackPath("/\tevil")).toBeNull();
    expect(safeCallbackPath("")).toBeNull();
    expect(safeCallbackPath(["/garage"])).toBeNull();
    expect(safeCallbackPath(undefined)).toBeNull();
  });
  it("rejects dot segments that collapse into a protocol-relative URL", () => {
    for (const raw of ["/.//evil.com", "/a/..//evil.com", "/%2e//evil.com", "/..//evil.com", "/././/evil.com/x?y"]) {
      expect(safeCallbackPath(raw), raw).toBeNull();
    }
    expect(safeCallbackPath("/garage/../dashboard")).toBe("/dashboard");
  });
});
