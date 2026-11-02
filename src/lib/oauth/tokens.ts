import { mcpResource } from "./config";
import { formatScopes } from "./params";

export const CODE_TTL_S = 10 * 60;
export const ACCESS_TOKEN_TTL_S = 60 * 60;
// Sliding: every refresh issues a new refresh token with the full lifetime, so only 60 idle days disconnect.
export const REFRESH_TOKEN_TTL_S = 60 * 24 * 60 * 60;
// However active, a connection has to be authorized again after this.
export const GRANT_MAX_AGE_S = 180 * 24 * 60 * 60;
export const LAST_USED_THROTTLE_MS = 60 * 1000;

export const ACCESS_TOKEN_PREFIX = "revv_at_";
export const REFRESH_TOKEN_PREFIX = "revv_rt_";
export const CODE_PREFIX = "revv_code_";

export type RefreshTokenState = "valid" | "grace" | "expired" | "reused";

// A token rotated this recently is accepted again: one client refreshing twice in parallel (two tool
// calls hitting 401 together) shouldn't lose the connection. Same idea as Auth0's reuse interval.
export const REFRESH_REUSE_GRACE_MS = 30 * 1000;

// Refresh tokens rotate on every use. One that was already exchanged coming back after the grace window
// means two parties hold it (one of them stolen), so the caller revokes the whole grant (OAuth 2.1 §4.3.1).
export function classifyRefreshToken(token: { rotatedAt: Date | null; expiresAt: Date }, now: Date): RefreshTokenState {
  if (token.rotatedAt) return now.getTime() - token.rotatedAt.getTime() <= REFRESH_REUSE_GRACE_MS ? "grace" : "reused";
  if (token.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

// A code is single use. A second exchange means it leaked, so the grant it produced is revoked (RFC 6749 §4.1.2).
export type CodeState = "valid" | "expired" | "replayed";
export function classifyCode(code: { usedAt: Date | null; expiresAt: Date }, now: Date): CodeState {
  if (code.usedAt) return "replayed";
  if (code.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

// Only once a minute per grant: verification runs on every MCP request.
export const shouldTouchLastUsed = (lastUsedAt: Date | null, now: Date) =>
  !lastUsedAt || now.getTime() - lastUsedAt.getTime() >= LAST_USED_THROTTLE_MS;

// RFC 8707 at the token endpoint: an optional `resource` must be our MCP endpoint and match what was
// authorized. Returns the resource the tokens are bound to.
export function resolveResource(requested: string | undefined, authorized: string | null, origin: string): { ok: true; resource: string | null } | { ok: false } {
  if (!requested) return { ok: true, resource: authorized };
  if (requested !== mcpResource(origin) || (authorized != null && requested !== authorized)) return { ok: false };
  return { ok: true, resource: requested };
}

export const secondsFrom =(now: Date, seconds: number) => new Date(now.getTime() + seconds * 1000);

export function tokenResponse(t: { accessToken: string; refreshToken: string; scopes: readonly string[] }) {
  return {
    access_token: t.accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_S,
    refresh_token: t.refreshToken,
    scope: formatScopes(t.scopes),
  };
}
