// Response helpers for the OAuth route handlers. No cookies are involved, so any origin may call them.

const MAX_BODY_BYTES = 16 * 1024;

export const corsHeaders = (methods: string) => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": methods,
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
});

export const preflight = (methods: string) => new Response(null, { status: 204, headers: corsHeaders(methods) });

// Token, registration and revocation responses must not be cached (RFC 6749 §5.1).
export function oauthJson(body: unknown, status = 200, extra?: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders("POST, OPTIONS"), "Cache-Control": "no-store", Pragma: "no-cache", ...extra },
  });
}

// RFC 6749 §5.2 error codes only: Claude treats invalid_grant as "sign in again".
export const oauthError = (error: string, description?: string, status = 400, extra?: Record<string, string>) =>
  oauthJson(description ? { error, error_description: description } : { error }, status, extra);

async function readBody(req: Request): Promise<string | null> {
  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) return null;
  const text = await req.text();
  return text.length > MAX_BODY_BYTES ? null : text;
}

export type FormBody = { get: (name: string) => string | undefined; repeated: string[] };

// application/x-www-form-urlencoded only (RFC 6749 §4.1.3). Parameters must not repeat (§3.2).
export async function readForm(req: Request): Promise<{ ok: true; form: FormBody } | { ok: false; response: Response }> {
  const type = req.headers.get("content-type") ?? "";
  if (!/^application\/x-www-form-urlencoded\b/i.test(type)) {
    return { ok: false, response: oauthError("invalid_request", "Content-Type must be application/x-www-form-urlencoded") };
  }
  const body = await readBody(req);
  if (body == null) return { ok: false, response: oauthError("invalid_request", "Request body too large", 413) };
  const params = new URLSearchParams(body);
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const key of params.keys()) (seen.has(key) ? repeated : seen).add(key);
  return { ok: true, form: { get: (name) => params.get(name) || undefined, repeated: [...repeated] } };
}

export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const body = await readBody(req);
  if (body == null) return { ok: false, response: oauthError("invalid_client_metadata", "Request body too large", 413) };
  try {
    return { ok: true, body: JSON.parse(body) };
  } catch {
    return { ok: false, response: oauthError("invalid_client_metadata", "Body must be JSON") };
  }
}
