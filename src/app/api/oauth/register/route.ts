import { registerClient } from "@/lib/oauth/clients";
import { oauthError, oauthJson, preflight, readJson } from "@/lib/oauth/http";
import { checkClientMetadata, registrationResponse } from "@/lib/oauth/registration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// RFC 7591 Dynamic Client Registration, for clients that don't use a Client ID Metadata Document.
// Public clients only: no secret is issued.
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body.ok) return body.response;
  const checked = checkClientMetadata(body.body);
  if (!checked.ok) return oauthError(checked.error, checked.description);
  try {
    const client = await registerClient(checked.client);
    if (!client) return oauthError("temporarily_unavailable", "Too many pending registrations, try again later", 429);
    return oauthJson(registrationResponse(client), 201);
  } catch (err) {
    console.error("[oauth] registration failed:", err);
    return oauthError("server_error", undefined, 500);
  }
}

export const OPTIONS = () => preflight("POST, OPTIONS");
