import type { PrismaConfig } from "prisma/config";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load the root .env so Prisma CLI commands (migrate, seed) can read DIRECT_URL
// without manual shell exports. Safe when the file is missing (CI generate).
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

// Prisma 7 moved connection URLs out of schema.prisma. The CLI (migrate/introspect)
// reads the direct URL from here; the runtime client uses a driver adapter (db.ts).
// Guarded so `prisma generate` works in CI where no DB env is set (generate does
// not need a datasource).
const migrateUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default {
  schema: "prisma/schema.prisma",
  ...(migrateUrl ? { datasource: { url: migrateUrl } } : {}),
  migrations: {
    seed: "sh prisma/seed.sh",
  },
} satisfies PrismaConfig;
