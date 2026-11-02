import { after } from "next/server";
import { exchangeCode, refreshTokens, sweepExpired } from "@/lib/oauth/grants";
import { oauthError, oauthJson, preflight, readForm } from "@/lib/oauth/http";
import { requestOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Token endpoint (RFC 6749 §3.2). Clients are public ("none"): the client_id in the body must be the one
// the code or refresh token was issued to, and PKCE proves possession of the code.
export async function POST(req: Request) {
  const read = await readForm(req);
  if (!read.ok) return read.response;
  const { form } = read;
  if (form.repeated.length) return oauthError("invalid_request", `Repeated parameter: ${form.repeated.join(", ")}`);
  // Any secret sent along is ignored: no client has one.
  const clientId = form.get("client_id");
  if (!clientId) return oauthError("invalid_client", "client_id is required", 401);
  const origin = requestOrigin(req);

  try {
    const grantType = form.get("grant_type");
    let result;
    if (grantType === "authorization_code") {
      const code = form.get("code");
      if (!code) return oauthError("invalid_request", "code is required");
      result = await exchangeCode({
        code,
        clientId,
        redirectUri: form.get("redirect_uri"),
        codeVerifier: form.get("code_verifier"),
        resource: form.get("resource"),
        origin,
      });
      // Housekeeping once per new connection, after the response is sent.
      if (result.ok) after(() => sweepExpired().catch((err) => console.error("[oauth] sweep failed:", err)));
    } else if (grantType === "refresh_token") {
      const refreshToken = form.get("refresh_token");
      if (!refreshToken) return oauthError("invalid_request", "refresh_token is required");
      result = await refreshTokens({ refreshToken, clientId, scope: form.get("scope"), resource: form.get("resource"), origin });
    } else {
      return oauthError(grantType ? "unsupported_grant_type" : "invalid_request", grantType ? undefined : "grant_type is required");
    }
    return result.ok ? oauthJson(result.body) : oauthError(result.error, result.description);
  } catch (err) {
    console.error("[oauth] token request failed:", err);
    return oauthError("server_error", undefined, 500);
  }
}

export const OPTIONS = () => preflight("POST, OPTIONS");
