import { z } from "zod";
import { isValidRedirectUri } from "./redirect";

export const MAX_REDIRECT_URIS = 10;
export const MAX_CLIENT_NAME = 80;
export const GRANT_TYPES = ["authorization_code", "refresh_token"] as const;

export type ClientMetadata = { name: string | null; redirectUris: string[] };
export type MetadataError = "invalid_redirect_uri" | "invalid_client_metadata";
export type MetadataCheck = { ok: true; client: ClientMetadata } | { ok: false; error: MetadataError; description: string };

// The name is self-declared and shown on the consent screen: drop control and bidi/zero-width
// characters so it can't disguise itself, and keep it short.
export function cleanClientName(raw: string | undefined | null): string | null {
  const name = (raw ?? "").replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim();
  return name ? name.slice(0, MAX_CLIENT_NAME) : null;
}

// RFC 7591 §2 fields we act on, shared by DCR requests and CIMD documents. Other fields are ignored.
const clientMetadataSchema = z.object({
  redirect_uris: z
    .array(z.string().refine(isValidRedirectUri, "must be https, or http on localhost/127.0.0.1/[::1], without a fragment"))
    .min(1)
    .max(MAX_REDIRECT_URIS),
  token_endpoint_auth_method: z.literal("none", 'only public clients are supported: use "none"').optional(),
  // Clients may declare grants and response types we don't offer (claude.ai's document lists a third
  // grant type); those are ignored, since we only ever issue codes and refresh tokens. What we need must be there.
  grant_types: z
    .array(z.string().max(200))
    .max(20)
    .refine((g) => g.includes("authorization_code"), "must include authorization_code")
    .optional(),
  response_types: z.array(z.string().max(200)).max(20).refine((r) => r.includes("code"), "must include code").optional(),
  client_name: z.string().max(1000).optional(),
});

export function checkClientMetadata(doc: unknown): MetadataCheck {
  const parsed = clientMetadataSchema.safeParse(doc);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.length ? String(issue.path[0]) : "body";
    return {
      ok: false,
      error: field === "redirect_uris" ? "invalid_redirect_uri" : "invalid_client_metadata",
      description: `${issue.path.join(".") || "body"}: ${issue.message}`,
    };
  }
  return {
    ok: true,
    client: { name: cleanClientName(parsed.data.client_name), redirectUris: [...new Set(parsed.data.redirect_uris)] },
  };
}

// RFC 7591 §3.2.1. Public client: no secret.
export function registrationResponse(client: { id: string; name: string | null; redirectUris: string[]; createdAt: Date }) {
  return {
    client_id: client.id,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: [...GRANT_TYPES],
    response_types: ["code"],
    ...(client.name ? { client_name: client.name } : {}),
  };
}
