import { test as base, expect, type Page } from "@playwright/test";

// Seeded admin (prisma/seed.ts upserts ADMIN_USERNAME/ADMIN_PASSWORD).
const ADMIN = {
  username: process.env.ADMIN_USERNAME ?? "admin",
  password: process.env.ADMIN_PASSWORD ?? "admin-password",
};

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|authorize|enter/i }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
}

export const test = base.extend<{
  loginAs: (role: "admin") => Promise<void>;
  registerHolder: () => Promise<{ username: string; password: string }>;
}>({
  loginAs: async ({ page }, provide) => {
    await provide(async (role) => {
      if (role === "admin") await signIn(page, ADMIN.username, ADMIN.password);
    });
  },
  registerHolder: async ({ page }, provide) => {
    await provide(async () => {
      const username = `holder_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
      const password = "Holder-Passw0rd!";
      await page.goto("/register");
      await page.getByLabel(/username/i).fill(username);
      await page.getByLabel(/password/i).fill(password);
      await page.getByRole("button", { name: /register|create/i }).click();
      await page.waitForURL((u) => !u.pathname.endsWith("/register"));
      return { username, password };
    });
  },
});

export { expect };
export type { Page };
