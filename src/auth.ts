import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";

// Full Node-runtime config: adds the db-backed Credentials provider on top of
// the edge-safe base. Used by the route handler, server actions, and RSCs.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Dev",
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
    }),
  ],
});
