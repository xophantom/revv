import { headers } from "next/headers";

// The origin the client used to reach us. OAuth metadata, the token audience and the MCP resource
// must match the URL typed into Claude exactly, so it comes from each request, not a fixed setting.
export function originFromHeaders(h: Headers, fallbackUrl?: string): string {
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() || h.get("host");
  if (!host) return new URL(fallbackUrl ?? "http://localhost:3000").origin;
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (local ? "http" : "https");
  return `${proto}://${host}`;
}

export const requestOrigin = (req: Request) => originFromHeaders(req.headers, req.url);

export async function currentOrigin(): Promise<string> {
  return originFromHeaders(await headers());
}
