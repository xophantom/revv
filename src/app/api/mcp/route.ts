import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyAccessToken } from "@/lib/oauth/verify";
import { MCP_SCOPE, mcpResource } from "@/lib/oauth/config";
import { requestOrigin } from "@/lib/origin";
import { INSTRUCTIONS, SERVER_INFO, registerRevvTools } from "@/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = createMcpHandler(registerRevvTools, { serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });

async function verify(req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  const info = await verifyAccessToken(bearer);
  if (!info) return undefined;
  // A token minted for another resource (RFC 8707 audience) isn't valid here.
  if (info.resource && info.resource !== mcpResource(requestOrigin(req))) return undefined;
  return { token: bearer, clientId: info.clientId, scopes: info.scopes, expiresAt: info.expiresAt, extra: { userId: info.userId } };
}

// No token (or a bad one) → 401 with WWW-Authenticate pointing at the protected resource metadata,
// which is how Claude discovers the OAuth server and starts the sign-in.
const authed = withMcpAuth(handler, verify, {
  required: true,
  requiredScopes: [MCP_SCOPE],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authed as GET, authed as POST, authed as DELETE };
