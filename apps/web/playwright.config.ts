import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;

// E2E runs against the docker-compose stack (postgres/redis/minio) with a seeded
// DB. Assumes `prisma migrate deploy && prisma db seed` already ran — see CI and
// docs/DEPLOY.md for the exact bring-up sequence.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // shared chain state (nullifiers) — keep deterministic
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    // Cross-origin isolation must survive locally too (bb.js WASM threads).
    launchOptions: { args: ["--enable-features=SharedArrayBuffer"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Acceptance must run against the production build, not `next dev`: the dev
    // server blocks cross-origin dev resources (HMR/client chunks) over 127.0.0.1,
    // which breaks hydration → forms submit as native GET and interactions hang.
    // CI builds in a prior step, so it only needs `start`; locally we build first.
    command: process.env.CI ? "pnpm start" : "pnpm build && pnpm start",
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
