import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-safe base config. No db / argon2 imports here (middleware runs on edge).
// JWT lives in @auth/core/jwt (extends Record<string, unknown>); pnpm's dual copy
// defeats interface augmentation, so token reads are cast explicitly.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id as string;
        token.role = user.role;
        token.username = (user as { username?: string }).username;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as Role;
        const username = token.username as string | undefined;
        if (username) session.user.name = username;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = auth?.user?.role;
      const needsAdmin = pathname.startsWith("/issuer") || pathname.startsWith("/admin");
      const needsHolder = pathname.startsWith("/wallet");
      if (!needsAdmin && !needsHolder) return true;
      if (!auth) return false; // middleware redirects to signIn page
      if (needsAdmin) return role === "ADMIN";
      if (needsHolder) return role === "HOLDER";
      return true;
    },
  },
  providers: [], // declared in auth.ts (Credentials needs Node-only argon2)
} satisfies NextAuthConfig;
