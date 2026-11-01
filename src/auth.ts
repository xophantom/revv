import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { sendVerificationRequest } from "@/lib/auth-email";

// Full Node-runtime config: adds the db adapter and providers on top of the
// edge-safe base. Used by the route handler, server actions, and RSCs.
const adapter = PrismaAdapter(db);

// Magic link turns on by itself once AUTH_RESEND_KEY is set. Until then (personal use),
// login is email-only with NO verification: whoever types an email gets that account.
export const magicLinkEnabled = Boolean(process.env.AUTH_RESEND_KEY);

const emailLogin = Credentials({
  name: "Email",
  credentials: { email: { label: "Email", type: "email" } },
  async authorize(creds) {
    const email = String(creds?.email ?? "").trim().toLowerCase();
    if (!email) return null;
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: { email, name: email.split("@")[0] },
    });
    return { id: user.id, email: user.email, name: user.name };
  },
});

// Per-email throttle for magic links. A pending token expires LINK_MAX_AGE after it is
// created, so "expires > now + LINK_MAX_AGE - window" means "created within the window".
const LINK_MAX_AGE_S = 24 * 60 * 60;
const LINK_WINDOW_MS = 10 * 60 * 1000;
const LINK_LIMIT = 3;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: {
    ...adapter,
    // Same default name the old upsert gave new accounts (shown in the Topbar).
    createUser: (user) => adapter.createUser!({ ...user, name: user.name ?? user.email.split("@")[0] }),
  },
  callbacks: {
    ...authConfig.callbacks,
    // Auth.js calls this before generating and sending the token (verificationRequest).
    async signIn({ user, email }) {
      if (!email?.verificationRequest || !user.email) return true;
      const recent = await db.verificationToken.count({
        where: { identifier: user.email, expires: { gt: new Date(Date.now() + LINK_MAX_AGE_S * 1000 - LINK_WINDOW_MS) } },
      });
      return recent < LINK_LIMIT || "/login?error=RateLimited";
    },
  },
  providers: [
    ...(magicLinkEnabled ? [Resend({ from: process.env.AUTH_EMAIL_FROM || "Revv <onboarding@resend.dev>", maxAge: LINK_MAX_AGE_S, sendVerificationRequest })] : []),
    // With magic link on, the email-only login survives only in local dev.
    ...(!magicLinkEnabled || process.env.NODE_ENV !== "production" ? [emailLogin] : []),
  ],
});
