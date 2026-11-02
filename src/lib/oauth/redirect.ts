export const MAX_REDIRECT_URI_LENGTH = 2000;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parse(uri: string): URL | null {
  try {
    return new URL(uri);
  } catch {
    return null;
  }
}

// http on the user's own machine: native apps such as Claude Code listen on a random port there.
export function isLoopbackRedirect(uri: string): boolean {
  const u = parse(uri);
  return u != null && u.protocol === "http:" && LOOPBACK_HOSTS.has(u.hostname);
}

// What a client may register: https anywhere, or http on loopback. No fragment, no credentials.
export function isValidRedirectUri(uri: string): boolean {
  if (uri.length > MAX_REDIRECT_URI_LENGTH || uri.includes("#")) return false;
  const u = parse(uri);
  if (!u || u.username || u.password) return false;
  return u.protocol === "https:" || (u.protocol === "http:" && LOOPBACK_HOSTS.has(u.hostname));
}

// Exact string match, except that a loopback URI matches on any port (RFC 8252 §7.3). Claude Code
// registers http://localhost/callback and http://127.0.0.1/callback and sends a different port each time.
export function matchRedirectUri(registered: readonly string[], requested: string): boolean {
  if (!isValidRedirectUri(requested)) return false;
  if (registered.includes(requested)) return true;
  if (!isLoopbackRedirect(requested)) return false;
  const want = new URL(requested);
  return registered.some((uri) => {
    if (!isLoopbackRedirect(uri)) return false;
    const got = new URL(uri);
    return got.hostname === want.hostname && got.pathname === want.pathname && got.search === want.search;
  });
}

// Host shown on the consent screen ("claude.ai", "localhost:3118").
export const redirectHost = (uri: string) => parse(uri)?.host ?? uri;

export function buildRedirect(uri: string, params: Record<string, string | null | undefined>): string {
  const u = new URL(uri);
  for (const [key, value] of Object.entries(params)) if (value != null) u.searchParams.set(key, value);
  return u.toString();
}

// Where /login may send the user back to: a path on this site only. "//host" and "/\host" are
// protocol-relative in browsers, so the parsed URL has to stay on the placeholder origin.
export function safeCallbackPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.length > 4000) return null;
  if ([...raw].some((c) => c === "\\" || c.charCodeAt(0) < 0x20)) return null;
  const base = "http://callback.invalid";
  const u = parse(`${base}${raw}`);
  if (!u || u.origin !== base) return null;
  const path = `${u.pathname}${u.search}${u.hash}`;
  // Dot segments collapse during parsing: "/.//evil.com" comes out as "//evil.com".
  return path.startsWith("//") ? null : path;
}
