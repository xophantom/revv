import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { markClientAuthorized } from "./clients";
import { hashToken, randomToken, verifyPkce } from "./crypto";
import { mcpResource } from "./config";
import { parseScopes } from "./params";
import {
  ACCESS_TOKEN_PREFIX,
  ACCESS_TOKEN_TTL_S,
  CODE_PREFIX,
  CODE_TTL_S,
  GRANT_MAX_AGE_S,
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_TTL_S,
  classifyCode,
  classifyRefreshToken,
  resolveResource,
  secondsFrom,
  tokenResponse,
} from "./tokens";

export type TokenResult =
  | { ok: true; body: ReturnType<typeof tokenResponse> }
  | { ok: false; error: "invalid_grant" | "invalid_scope" | "invalid_target"; description: string };

const invalidGrant = (description: string): TokenResult => ({ ok: false, error: "invalid_grant", description });
const invalidTarget = (origin: string): TokenResult => ({ ok: false, error: "invalid_target", description: `resource must be ${mcpResource(origin)}` });

export async function createAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: string | null;
}): Promise<string> {
  const code = randomToken(CODE_PREFIX);
  await db.oAuthCode.create({ data: { ...input, codeHash: hashToken(code), expiresAt: secondsFrom(new Date(), CODE_TTL_S) } });
  await markClientAuthorized(input.clientId);
  return code;
}

async function issueTokens(tx: Prisma.TransactionClient, grantId: string, now: Date) {
  const accessToken = randomToken(ACCESS_TOKEN_PREFIX);
  const refreshToken = randomToken(REFRESH_TOKEN_PREFIX);
  await tx.oAuthToken.createMany({
    data: [
      { grantId, kind: "ACCESS", tokenHash: hashToken(accessToken), expiresAt: secondsFrom(now, ACCESS_TOKEN_TTL_S) },
      { grantId, kind: "REFRESH", tokenHash: hashToken(refreshToken), expiresAt: secondsFrom(now, REFRESH_TOKEN_TTL_S) },
    ],
  });
  return { accessToken, refreshToken };
}

const revokeGrant = (id: string) => db.oAuthGrant.deleteMany({ where: { id } });

export async function exchangeCode(p: {
  code: string;
  clientId: string;
  redirectUri: string | undefined;
  codeVerifier: string | undefined;
  resource: string | undefined;
  origin: string;
}): Promise<TokenResult> {
  const now = new Date();
  const code = await db.oAuthCode.findUnique({ where: { codeHash: hashToken(p.code) } });
  if (!code) return invalidGrant("Unknown authorization code");
  const state = classifyCode(code, now);
  if (state === "replayed") {
    if (code.grantId) await revokeGrant(code.grantId);
    return invalidGrant("Authorization code already used");
  }
  if (state === "expired") return invalidGrant("Authorization code expired");
  if (code.clientId !== p.clientId) return invalidGrant("Authorization code was issued to another client");
  if (code.redirectUri !== p.redirectUri) return invalidGrant("redirect_uri differs from the authorization request");
  if (!verifyPkce(p.codeVerifier, code.codeChallenge)) return invalidGrant("PKCE verification failed");
  const target = resolveResource(p.resource, code.resource, p.origin);
  if (!target.ok) return invalidTarget(p.origin);

  const tokens = await db.$transaction(async (tx) => {
    // Claimed only after every check, so a stolen code sent without its verifier doesn't burn it.
    const claim = await tx.oAuthCode.updateMany({ where: { id: code.id, usedAt: null }, data: { usedAt: now } });
    if (claim.count !== 1) return null;
    const grant = await tx.oAuthGrant.create({
      data: { userId: code.userId, clientId: code.clientId, scopes: code.scopes, resource: target.resource, expiresAt: secondsFrom(now, REFRESH_TOKEN_TTL_S) },
    });
    await tx.oAuthCode.update({ where: { id: code.id }, data: { grantId: grant.id } });
    return issueTokens(tx, grant.id, now);
  });
  if (!tokens) return invalidGrant("Authorization code already used");
  return { ok: true, body: tokenResponse({ ...tokens, scopes: code.scopes }) };
}

export async function refreshTokens(p: {
  refreshToken: string;
  clientId: string;
  scope: string | undefined;
  resource: string | undefined;
  origin: string;
}): Promise<TokenResult> {
  const now = new Date();
  const token = await db.oAuthToken.findUnique({ where: { tokenHash: hashToken(p.refreshToken) }, include: { grant: true } });
  if (!token || token.kind !== "REFRESH") return invalidGrant("Unknown refresh token");
  const { grant } = token;
  if (grant.clientId !== p.clientId) return invalidGrant("Refresh token was issued to another client");
  const state = classifyRefreshToken(token, now);
  if (state === "reused") {
    await revokeGrant(grant.id);
    return invalidGrant("Refresh token already used; the connection was revoked");
  }
  if (state === "expired") return invalidGrant("Refresh token expired");
  // Refreshes slide the expiry forever otherwise; an absolute limit makes a leaked chain die eventually.
  if (now.getTime() - grant.createdAt.getTime() > GRANT_MAX_AGE_S * 1000) {
    await revokeGrant(grant.id);
    return invalidGrant("Connection older than the maximum lifetime; connect again");
  }
  if (p.scope) {
    // May only narrow (RFC 6749 §6); tokens keep the grant's scopes, reported in `scope`.
    const asked = parseScopes(p.scope);
    if (!asked.ok || asked.scopes.some((s) => !grant.scopes.includes(s))) {
      return { ok: false, error: "invalid_scope", description: "scope exceeds what was granted" };
    }
  }
  if (!resolveResource(p.resource, grant.resource, p.origin).ok) return invalidTarget(p.origin);

  const tokens = await db.$transaction(async (tx) => {
    // First use marks it rotated. A concurrent request that loses this race lands in the grace window
    // like any repeat within it, and gets its own pair instead of revoking the connection.
    await tx.oAuthToken.updateMany({ where: { id: token.id, rotatedAt: null }, data: { rotatedAt: now } });
    await tx.oAuthGrant.update({ where: { id: grant.id }, data: { expiresAt: secondsFrom(now, REFRESH_TOKEN_TTL_S) } });
    // Rotated refresh tokens stay until they expire, so a reuse is still recognized.
    await tx.oAuthToken.deleteMany({ where: { grantId: grant.id, expiresAt: { lt: now } } });
    return issueTokens(tx, grant.id, now);
  });
  return { ok: true, body: tokenResponse({ ...tokens, scopes: grant.scopes }) };
}

// RFC 7009. A refresh token takes its whole grant with it; an access token goes alone.
export async function revokeToken(rawToken: string, clientId: string): Promise<"revoked" | "unknown" | "wrong_client"> {
  const token = await db.oAuthToken.findUnique({ where: { tokenHash: hashToken(rawToken) }, include: { grant: { select: { clientId: true } } } });
  if (!token) return "unknown";
  if (token.grant.clientId !== clientId) return "wrong_client";
  if (token.kind === "REFRESH") await revokeGrant(token.grantId);
  else await db.oAuthToken.deleteMany({ where: { id: token.id } });
  return "revoked";
}

// The "Desconectar" button on /conexoes.
export async function revokeUserGrant(userId: string, grantId: string): Promise<boolean> {
  const { count } = await db.oAuthGrant.deleteMany({ where: { id: grantId, userId } });
  return count > 0;
}

// Codes are kept a day past expiry so a late replay is still recognized and revokes its grant.
export async function sweepExpired(now = new Date()) {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await db.$transaction([
    db.oAuthCode.deleteMany({ where: { expiresAt: { lt: dayAgo } } }),
    db.oAuthToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.oAuthGrant.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
}
