import { describe, it, expect } from "vitest";
import { checkClientMetadata, cleanClientName, registrationResponse } from "@/lib/oauth/registration";
import { cimdUrlProblem, isCimdClientId, isPublicAddress, parseClientMetadataDocument } from "@/lib/oauth/cimd";

const CLAUDE_CODE_URL = "https://claude.ai/oauth/claude-code-client-metadata";
// As served at CLAUDE_CODE_URL.
const CLAUDE_CODE_DOC = {
  client_id: CLAUDE_CODE_URL,
  client_name: "Claude Code",
  client_uri: "https://claude.ai",
  redirect_uris: ["http://localhost/callback", "http://127.0.0.1/callback"],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
};

describe("dynamic client registration", () => {
  it("accepts Claude's hosted callback and loopback URIs", () => {
    const res = checkClientMetadata({
      client_name: "Claude",
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback", "http://localhost/callback", "https://claude.ai/api/mcp/auth_callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "revv offline_access",
      logo_uri: "https://claude.ai/logo.png",
    });
    expect(res).toEqual({ ok: true, client: { name: "Claude", redirectUris: ["https://claude.ai/api/mcp/auth_callback", "http://localhost/callback"] } });
  });
  it("defaults the optional fields", () => {
    expect(checkClientMetadata({ redirect_uris: ["https://app.example.com/cb"] })).toEqual({ ok: true, client: { name: null, redirectUris: ["https://app.example.com/cb"] } });
  });
  it("rejects bad redirect URIs with invalid_redirect_uri", () => {
    for (const redirect_uris of [undefined, [], ["http://example.com/cb"], ["https://a.com/cb#f"], [42], Array(11).fill("https://a.com/cb")]) {
      const res = checkClientMetadata({ redirect_uris });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("invalid_redirect_uri");
    }
  });
  it("only registers public clients for the code flow", () => {
    const base = { redirect_uris: ["https://a.com/cb"] };
    for (const extra of [
      { token_endpoint_auth_method: "client_secret_basic" },
      { token_endpoint_auth_method: "private_key_jwt" },
      { grant_types: ["client_credentials"] },
      { response_types: [] },
      { grant_types: ["refresh_token"] },
      { response_types: ["token"] },
      { client_name: 42 },
    ]) {
      const res = checkClientMetadata({ ...base, ...extra });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("invalid_client_metadata");
    }
    expect(checkClientMetadata("nope").ok).toBe(false);
    expect(checkClientMetadata(null).ok).toBe(false);
  });
  it("cleans the self-declared name", () => {
    expect(cleanClientName("  Claude‮ edoC \n ")).toBe("Claude edoC");
    expect(cleanClientName("a".repeat(500))).toHaveLength(80);
    expect(cleanClientName("​")).toBeNull();
  });
  it("answers in RFC 7591 form, without a secret", () => {
    const res = registrationResponse({ id: "dcr_abc", name: "Claude", redirectUris: ["https://claude.ai/api/mcp/auth_callback"], createdAt: new Date("2026-11-02T12:00:00Z") });
    expect(res).toEqual({
      client_id: "dcr_abc",
      client_id_issued_at: 1793620800,
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: "Claude",
    });
    expect(res).not.toHaveProperty("client_secret");
    expect(registrationResponse({ id: "dcr_x", name: null, redirectUris: [], createdAt: new Date(0) })).not.toHaveProperty("client_name");
  });
});

describe("client ID metadata documents", () => {
  it("tells CIMD client ids from DCR ones", () => {
    expect(isCimdClientId(CLAUDE_CODE_URL)).toBe(true);
    expect(isCimdClientId("dcr_abc")).toBe(false);
    expect(isCimdClientId("http://claude.ai/x")).toBe(false);
  });
  it("accepts Claude Code's URL", () => {
    expect(cimdUrlProblem(CLAUDE_CODE_URL)).toBeNull();
  });
  it("rejects URLs the draft forbids or we shouldn't fetch", () => {
    for (const url of [
      "https://claude.ai",
      "https://claude.ai/",
      "https://claude.ai/a/../b",
      "https://claude.ai/a#frag",
      "https://user@claude.ai/meta",
      "https://claude.ai:8443/meta",
      "https://claude.ai:443/meta",
      "https://CLAUDE.ai/meta",
      "https://127.0.0.1/meta",
      "https://[::1]/meta",
      "https://localhost/meta",
      "https://intranet/meta",
      "https://printer.local/meta",
      "https://metadata.google.internal/meta",
      "http://claude.ai/meta",
    ]) {
      expect(cimdUrlProblem(url), url).not.toBeNull();
    }
  });
  it("parses Claude Code's document", () => {
    const res = parseClientMetadataDocument(CLAUDE_CODE_URL, CLAUDE_CODE_DOC);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.client).toEqual({ name: "Claude Code", redirectUris: ["http://localhost/callback", "http://127.0.0.1/callback"] });
  });
  it("requires the document to name itself and carry no secret", () => {
    expect(parseClientMetadataDocument(CLAUDE_CODE_URL, { ...CLAUDE_CODE_DOC, client_id: "https://evil.com/meta" }).ok).toBe(false);
    expect(parseClientMetadataDocument(CLAUDE_CODE_URL, { ...CLAUDE_CODE_DOC, client_secret: "x" }).ok).toBe(false);
    expect(parseClientMetadataDocument(CLAUDE_CODE_URL, { ...CLAUDE_CODE_DOC, token_endpoint_auth_method: "client_secret_post" }).ok).toBe(false);
    expect(parseClientMetadataDocument(CLAUDE_CODE_URL, { ...CLAUDE_CODE_DOC, redirect_uris: ["http://evil.com/cb"] }).ok).toBe(false);
    expect(parseClientMetadataDocument(CLAUDE_CODE_URL, [CLAUDE_CODE_DOC]).ok).toBe(false);
  });
  it("only fetches from public addresses", () => {
    expect(isPublicAddress("160.79.104.10")).toBe(true);
    expect(isPublicAddress("2606:4700::6810:84e5")).toBe(true);
    for (const ip of ["10.0.0.1", "172.20.1.1", "192.168.1.1", "127.0.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "nonsense"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });
});

describe("claude.ai's published client (CIMD)", () => {
  // As served at https://claude.ai/oauth/mcp-oauth-client-metadata on 2026-11-09. It lists a grant we
  // don't offer (jwt-bearer); rejecting it blocked "Usar a identidade publicada do Claude".
  const CLAUDE_AI = {
    client_id: "https://claude.ai/oauth/mcp-oauth-client-metadata",
    client_name: "Claude",
    client_uri: "https://claude.ai",
    redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
    grant_types: ["authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:jwt-bearer"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
  it("is accepted, ignoring the grant types we don't offer", () => {
    const res = parseClientMetadataDocument(CLAUDE_AI.client_id, CLAUDE_AI);
    expect(res).toMatchObject({ ok: true, client: { name: "Claude", redirectUris: ["https://claude.ai/api/mcp/auth_callback"] } });
  });
});
