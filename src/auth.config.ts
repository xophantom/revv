import type { NextAuthConfig } from "next-auth";

// Edge-safe config: NO db / Prisma / Node-only imports. Used by middleware
// (Edge runtime) to verify the JWT session, and spread into the full Node
// config in auth.ts. Providers with db access live ONLY in auth.ts.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = (user as { id: string }).id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
