import { revokeToken } from "@/lib/oauth/grants";
import { oauthError, oauthJson, preflight, readForm } from "@/lib/oauth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// RFC 7009. Unknown or already revoked tokens still answer 200, as the RFC asks.
export async function POST(req: Request) {
  const read = await readForm(req);
  if (!read.ok) return read.response;
  const { form } = read;
  const token = form.get("token");
  if (!token || form.repeated.length) return oauthError("invalid_request", "token is required, once");
  const clientId = form.get("client_id");
  if (!clientId) return oauthError("invalid_client", "client_id is required", 401);
  try {
    const outcome = await revokeToken(token, clientId);
    if (outcome === "wrong_client") return oauthError("invalid_client", "The token was issued to another client", 401);
    return oauthJson({});
  } catch (err) {
    console.error("[oauth] revocation failed:", err);
    return oauthError("server_error", undefined, 500);
  }
}

export const OPTIONS = () => preflight("POST, OPTIONS");
