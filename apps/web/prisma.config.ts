import type { PrismaConfig } from "prisma/config";

// Prisma 7 moved connection URLs out of schema.prisma. The CLI (migrate/introspect)
// reads the direct URL from here; the runtime client uses a driver adapter (db.ts).
// Guarded so `prisma generate` works in CI where no DB env is set (generate does
// not need a datasource).
const migrateUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default {
  schema: "prisma/schema.prisma",
  ...(migrateUrl ? { datasource: { url: migrateUrl } } : {}),
} satisfies PrismaConfig;
