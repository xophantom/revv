import { randomBytes } from "node:crypto";
import type { OAuthClient } from "@prisma/client";
import { db } from "@/lib/db";
import { CIMD_STALE_MS, CIMD_TTL_MS, fetchClientMetadataDocument, isCimdClientId } from "./cimd";
import type { ClientMetadata } from "./registration";

export type KnownClient = Pick<OAuthClient, "id" | "kind" | "name" | "redirectUris">;
export type ClientLookup = { ok: true; client: KnownClient } | { ok: false; reason: string };

// Registration (DCR) and CIMD lookups are open to anyone, so clients nobody has authorized yet are
// short-lived and capped: a flood can't fill the database, and an authorized client is never purged.
const PENDING_CLIENT_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_PENDING_CLIENTS = 100;

async function roomForPendingClient(): Promise<boolean> {
  const cutoff = new Date(Date.now() - PENDING_CLIENT_TTL_MS);
  await db.oAuthClient.deleteMany({ where: { authorizedAt: null, createdAt: { lt: cutoff }, grants: { none: {} }, codes: { none: {} } } });
  return (await db.oAuthClient.count({ where: { authorizedAt: null } })) < MAX_PENDING_CLIENTS;
}

// DCR clients come from the table. CIMD clients are fetched from their URL and cached for a day.
export async function resolveClient(clientId: string): Promise<ClientLookup> {
  if (!isCimdClientId(clientId)) {
    const client = clientId.length <= 200 ? await db.oAuthClient.findUnique({ where: { id: clientId } }) : null;
    return client?.kind === "DCR" ? { ok: true, client } : { ok: false, reason: "unknown client_id" };
  }
  const cached = await db.oAuthClient.findUnique({ where: { id: clientId } });
  const age = cached?.fetchedAt ? Date.now() - cached.fetchedAt.getTime() : Infinity;
  if (cached && age < CIMD_TTL_MS) return { ok: true, client: cached };
  // Checked before fetching, so a flood of made-up client URLs doesn't turn into outbound requests either.
  if (!cached && !(await roomForPendingClient())) return { ok: false, reason: "too many pending clients, try again later" };

  const fetched = await fetchClientMetadataDocument(clientId);
  if (!fetched.ok) {
    if (cached && age < CIMD_STALE_MS) {
      console.warn(`[oauth] CIMD refetch failed for ${clientId} (${fetched.reason}); using the cached copy`);
      return { ok: true, client: cached };
    }
    return { ok: false, reason: fetched.reason };
  }
  // Only what the flow needs; the document itself (up to 64 KB) isn't kept.
  const data = { name: fetched.client.name, redirectUris: fetched.client.redirectUris, fetchedAt: new Date() };
  const client = await db.oAuthClient.upsert({ where: { id: clientId }, create: { id: clientId, kind: "CIMD", ...data }, update: data });
  return { ok: true, client };
}

// Called on consent: from here on the client is kept.
export async function markClientAuthorized(clientId: string) {
  await db.oAuthClient.updateMany({ where: { id: clientId, authorizedAt: null }, data: { authorizedAt: new Date() } });
}

// null when the pending-registration cap is reached.
export async function registerClient(meta: ClientMetadata) {
  if (!(await roomForPendingClient())) return null;
  return db.oAuthClient.create({
    data: { id: `dcr_${randomBytes(16).toString("base64url")}`, kind: "DCR", name: meta.name, redirectUris: meta.redirectUris },
  });
}
