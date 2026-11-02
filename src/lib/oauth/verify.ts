import { db } from "@/lib/db";
import { hashToken } from "./crypto";
import { LAST_USED_THROTTLE_MS, shouldTouchLastUsed } from "./tokens";

export type AccessTokenInfo = {
  userId: string;
  clientId: string;
  clientName: string | null;
  scopes: string[];
  expiresAt: number; // epoch seconds
  resource: string | null;
};

// For the MCP resource server. null when the token is unknown, expired or revoked (revoking deletes it).
export async function verifyAccessToken(token: string): Promise<AccessTokenInfo | null> {
  if (!token || token.length > 512) return null;
  const now = new Date();
  const row = await db.oAuthToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      kind: true,
      expiresAt: true,
      grant: { select: { id: true, userId: true, scopes: true, resource: true, lastUsedAt: true, client: { select: { id: true, name: true } } } },
    },
  });
  if (!row || row.kind !== "ACCESS" || row.expiresAt <= now) return null;
  const { grant } = row;
  if (shouldTouchLastUsed(grant.lastUsedAt, now)) {
    // The condition repeats the throttle in SQL so concurrent requests write once. Never fails the request.
    await db.oAuthGrant
      .updateMany({
        where: { id: grant.id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(now.getTime() - LAST_USED_THROTTLE_MS) } }] },
        data: { lastUsedAt: now },
      })
      .catch((err) => console.error("[oauth] lastUsedAt update failed:", err));
  }
  return {
    userId: grant.userId,
    clientId: grant.client.id,
    clientName: grant.client.name,
    scopes: grant.scopes,
    expiresAt: Math.floor(row.expiresAt.getTime() / 1000),
    resource: grant.resource,
  };
}
