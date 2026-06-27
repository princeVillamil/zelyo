import { test, expect } from "./fixtures";
import { checkA11y } from "./axe";

// SPEC §13.4 — auth & role redirects, plus an axe AA floor on key public pages.
test.describe("auth & role redirects (SPEC §13.4)", () => {
  test("unauthenticated visitor to /issuer is redirected to /login", async ({ page }) => {
    await page.goto("/issuer");
    await expect(page).toHaveURL(/\/login/);
    await checkA11y(page, "login");
  });

  test("seeded admin can reach the mint page", async ({ page, loginAs }) => {
    await loginAs("admin");
    await page.goto("/issuer/mint");
    await expect(page).toHaveURL(/\/issuer\/mint/);
    await expect(
      // h1 specifically — MintForm also has an h2 "Mint Log" that matches /mint/i.
      page.getByRole("heading", { level: 1, name: /mint|issue|distillation|seal/i }),
    ).toBeVisible();
    await checkA11y(page, "issuer/mint");
  });

  test("a holder is blocked from /issuer/**", async ({ page, registerHolder }) => {
    await registerHolder();
    await page.goto("/issuer/mint");
    // Middleware redirects non-ADMIN away from /issuer/** — the mint form never renders.
    await expect(page).not.toHaveURL(/\/issuer\/mint$/);
    await expect(page.getByLabel(/learner|track|course/i)).toHaveCount(0);
  });

  test("home and job board are accessible", async ({ page }) => {
    await page.goto("/");
    await checkA11y(page, "home");
    await page.goto("/jobs");
    await checkA11y(page, "jobs");
  });
});
