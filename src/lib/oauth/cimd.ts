import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { checkClientMetadata, type ClientMetadata } from "./registration";

// Client ID Metadata Documents (draft-ietf-oauth-client-id-metadata-document): the client_id is an
// HTTPS URL and the document it serves is the registration.

export const CIMD_TTL_MS = 24 * 60 * 60 * 1000;
// A failed refetch keeps using the cached copy for this long, so a blip on the client's host doesn't block sign-in.
export const CIMD_STALE_MS = 7 * CIMD_TTL_MS;
const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 64 * 1024;

export const isCimdClientId = (clientId: string) => clientId.startsWith("https://");

// The URL rules of the draft (https, a path, no fragment or credentials, no dot segments), plus limits
// against SSRF: we fetch it server-side, so only a public DNS name on the default port.
export function cimdUrlProblem(clientId: string): string | null {
  if (clientId.length > 2000) return "is too long";
  let u: URL;
  try {
    u = new URL(clientId);
  } catch {
    return "is not a URL";
  }
  if (u.protocol !== "https:") return "must use https";
  if (u.username || u.password) return "must not contain credentials";
  if (clientId.includes("#")) return "must not contain a fragment";
  // Also rules out dot segments, which URL parsing resolves away.
  if (u.href !== clientId) return "must be in canonical form";
  if (u.pathname === "/") return "must have a path";
  if (u.port) return "must use the default port";
  const host = u.hostname;
  if (isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".") || /\.(localhost|local|internal|home\.arpa)$/.test(host)) {
    return "must be a public host name";
  }
  return null;
}

const NON_PUBLIC = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) NON_PUBLIC.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [["::", 127], ["64:ff9b::", 96], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) {
  NON_PUBLIC.addSubnet(net, prefix, "ipv6");
}

// BlockList also matches IPv4-mapped IPv6 (::ffff:10.0.0.1) against the IPv4 ranges.
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  return family !== 0 && !NON_PUBLIC.check(ip, family === 6 ? "ipv6" : "ipv4");
}

export type CimdResult = { ok: true; client: ClientMetadata; document: Record<string, unknown> } | { ok: false; reason: string };

export function parseClientMetadataDocument(clientId: string, doc: unknown): CimdResult {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { ok: false, reason: "the document is not a JSON object" };
  const d = doc as Record<string, unknown>;
  if (d.client_id !== clientId) return { ok: false, reason: "the document's client_id differs from its URL" };
  if ("client_secret" in d || "client_secret_expires_at" in d) return { ok: false, reason: "the document must not carry a client secret" };
  const check = checkClientMetadata(d);
  return check.ok ? { ok: true, client: check.client, document: d } : { ok: false, reason: check.description };
}

async function readCapped(res: Response, max: number): Promise<string | null> {
  if (Number(res.headers.get("content-length")) > max) return null;
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function fetchClientMetadataDocument(clientId: string): Promise<CimdResult> {
  const problem = cimdUrlProblem(clientId);
  if (problem) return { ok: false, reason: `the client_id URL ${problem}` };
  try {
    const addresses = await lookup(new URL(clientId).hostname, { all: true });
    if (!addresses.length || !addresses.every((a) => isPublicAddress(a.address))) return { ok: false, reason: "the host resolves to a private address" };
  } catch {
    return { ok: false, reason: "the host could not be resolved" };
  }
  let doc: unknown;
  try {
    // No cookies or credentials, no redirects, bounded in time and size.
    const res = await fetch(clientId, {
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, reason: `the document returned HTTP ${res.status}` };
    if (!/^application\/([\w.-]+\+)?json\b/i.test(res.headers.get("content-type") ?? "")) return { ok: false, reason: "the document is not JSON" };
    const body = await readCapped(res, MAX_BYTES);
    if (body == null) return { ok: false, reason: "the document is too large" };
    doc = JSON.parse(body);
  } catch {
    return { ok: false, reason: "the document could not be fetched or parsed" };
  }
  return parseClientMetadataDocument(clientId, doc);
}
