import { generateProtectedResourceMetadata, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { SCOPES_SUPPORTED, mcpResource } from "@/lib/oauth/config";
import { requestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

// RFC 9728: tells Claude which authorization server issues tokens for the MCP endpoint. `resource`
// must equal the URL typed into Claude, so both values come from the request's own origin.
export function GET(req: Request) {
  const origin = requestOrigin(req);
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [origin],
    resourceUrl: mcpResource(origin),
    additionalMetadata: { scopes_supported: [...SCOPES_SUPPORTED], bearer_methods_supported: ["header"], resource_name: "Revv" },
  });
  return Response.json(metadata, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300", Vary: "Host, X-Forwarded-Host" } });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
