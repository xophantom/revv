import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// 256 random bits. The prefix only helps people and secret scanners tell the kinds apart.
export const randomToken = (prefix: string) => `${prefix}${randomBytes(32).toString("base64url")}`;

// Codes and tokens are stored and looked up by this hash only. They are high-entropy, so no salt is needed.
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// RFC 7636: the verifier is 43–128 unreserved characters; an S256 challenge is base64url(SHA-256), 43 characters.
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;
const S256_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export const isS256Challenge = (challenge: string) => S256_CHALLENGE.test(challenge);
export const s256 = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function verifyPkce(verifier: string | undefined, challenge: string): boolean {
  if (!verifier || !VERIFIER.test(verifier) || !isS256Challenge(challenge)) return false;
  return safeEqual(s256(verifier), challenge);
}
