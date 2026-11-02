import { MCP_SCOPE, SCOPES_SUPPORTED, mcpResource } from "./config";
import { isS256Challenge } from "./crypto";

export type ScopeResult = { ok: true; scopes: string[] } | { ok: false; invalid: string[] };

// Space-delimited (RFC 6749 §3.3). Absent means revv; revv is always granted, since it is the only
// scope that reaches any data. Returned in a stable order.
export function parseScopes(raw: string | null | undefined): ScopeResult {
  const requested = new Set((raw ?? "").split(/\s+/).filter(Boolean));
  const supported: readonly string[] = SCOPES_SUPPORTED;
  const invalid = [...requested].filter((s) => !supported.includes(s));
  if (invalid.length) return { ok: false, invalid };
  requested.add(MCP_SCOPE);
  return { ok: true, scopes: supported.filter((s) => requested.has(s)) };
}

export const formatScopes = (scopes: readonly string[]) => scopes.join(" ");

export const AUTHORIZE_PARAMS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "scope",
  "state",
  "resource",
] as const;
export type AuthorizeParamName = (typeof AUTHORIZE_PARAMS)[number];
export type AuthorizeParams = Partial<Record<AuthorizeParamName, string>>;

// Next hands repeated query params over as arrays; OAuth forbids repeating them (RFC 6749 §3.1).
export function readAuthorizeParams(source: Record<string, string | string[] | undefined>): { params: AuthorizeParams; repeated: AuthorizeParamName[] } {
  const params: AuthorizeParams = {};
  const repeated: AuthorizeParamName[] = [];
  for (const name of AUTHORIZE_PARAMS) {
    const value = source[name];
    if (Array.isArray(value)) repeated.push(name);
    else if (value) params[name] = value;
  }
  return { params, repeated };
}

export function paramsFromForm(fd: FormData): ReturnType<typeof readAuthorizeParams> {
  const source: Record<string, string | string[] | undefined> = {};
  for (const name of AUTHORIZE_PARAMS) {
    const values = fd.getAll(name).filter((v): v is string => typeof v === "string");
    source[name] = values.length > 1 ? values : values[0];
  }
  return readAuthorizeParams(source);
}

export type AuthorizeRequest = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  state: string | null;
  resource: string | null;
};

export type ParamsCheck =
  | { ok: true; request: AuthorizeRequest }
  | { ok: false; error: "invalid_request" | "unsupported_response_type" | "invalid_scope" | "invalid_target"; description: string };

// Everything after the client and the redirect_uri, which the caller has already trusted. These
// errors go back to the client's redirect_uri.
export function checkAuthorizeParams(p: AuthorizeParams & { client_id: string; redirect_uri: string }, origin: string, repeated: readonly string[] = []): ParamsCheck {
  if (repeated.length) return { ok: false, error: "invalid_request", description: `Repeated parameter: ${repeated.join(", ")}` };
  if (p.response_type !== "code") return { ok: false, error: "unsupported_response_type", description: "Only response_type=code is supported" };
  if (!p.code_challenge) return { ok: false, error: "invalid_request", description: "code_challenge is required (PKCE)" };
  if (p.code_challenge_method !== "S256") return { ok: false, error: "invalid_request", description: "code_challenge_method must be S256" };
  if (!isS256Challenge(p.code_challenge)) return { ok: false, error: "invalid_request", description: "Malformed code_challenge" };
  const scopes = parseScopes(p.scope);
  if (!scopes.ok) return { ok: false, error: "invalid_scope", description: `Unsupported scope: ${scopes.invalid.join(" ")}` };
  if (p.resource && p.resource !== mcpResource(origin)) return { ok: false, error: "invalid_target", description: `Unknown resource; expected ${mcpResource(origin)}` };
  if (p.state && p.state.length > 2000) return { ok: false, error: "invalid_request", description: "state is too long" };
  return {
    ok: true,
    request: {
      clientId: p.client_id,
      redirectUri: p.redirect_uri,
      codeChallenge: p.code_challenge,
      scopes: scopes.scopes,
      state: p.state ?? null,
      resource: p.resource ?? null,
    },
  };
}
