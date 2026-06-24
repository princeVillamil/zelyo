import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "@node-rs/argon2";
import { authConfig } from "./auth.config";
import { credentialsSchema } from "./src/lib/validation/auth";
import { db } from "./src/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Auth.js v5 reads AUTH_SECRET from the environment automatically.
  trustHost: true,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;

        const user = await db.user.findUnique({ where: { username } });
        // Constant-ish time: always run a verify even when the user is missing.
        const hashToCheck =
          user?.passwordHash ??
          "$argon2id$v=19$m=19456,t=2,p=1$ZGVjb3lkZWNveWRlY295$0000000000000000000000000000000000000000000";
        const ok = await verify(hashToCheck, password).catch(() => false);

        if (!user || !ok) return null; // generic failure — never reveal which field
        return { id: user.id, username: user.username, role: user.role };
      },
    }),
  ],
});
