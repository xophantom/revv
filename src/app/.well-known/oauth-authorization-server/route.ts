import { authorizationServerMetadata } from "@/lib/oauth/metadata";
import { corsHeaders, preflight } from "@/lib/oauth/http";
import { requestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

// RFC 8414. Claude reads it after the protected resource metadata names this origin as the issuer.
export function GET(req: Request) {
  return Response.json(authorizationServerMetadata(requestOrigin(req)), {
    headers: { ...corsHeaders("GET, OPTIONS"), "Cache-Control": "public, max-age=300", Vary: "Host, X-Forwarded-Host" },
  });
}

export const OPTIONS = () => preflight("GET, OPTIONS");
