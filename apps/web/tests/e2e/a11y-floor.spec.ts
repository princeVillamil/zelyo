import { test, expect } from "./fixtures";

// BRAND.md §10 — accessibility floor: visible focus, ≥40px hit targets,
// reduced-motion disables the foil shine, and status is never color-only.
test("visible keyboard focus + hit targets ≥40px on the primary CTA", async ({ page }) => {
  await page.goto("/");
  const cta = page
    .getByRole("button")
    .or(page.getByRole("link"))
    .filter({ hasText: /verify|prove|explore|begin|enter|reveals/i })
    .first();
  await cta.focus();
  const focusStyle = await cta.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      outlineWidth: s.outlineWidth,
      outlineStyle: s.outlineStyle,
      boxShadow: s.boxShadow,
      borderColor: s.borderColor,
    };
  });
  const hasVisibleFocus =
    (focusStyle.outlineStyle !== "none" && parseFloat(focusStyle.outlineWidth) > 0) ||
    focusStyle.boxShadow !== "none";
  expect(hasVisibleFocus).toBe(true);
  const box = await cta.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(40);
});

test("reduced-motion disables the foil shine and translate", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  const shine = page.locator(".foil-stamp").first();
  await expect(shine).toBeVisible();
  const anim = await shine.evaluate(
    (el) => getComputedStyle(el, "::before").animationName,
  );
  expect(anim === "none" || anim === "").toBe(true);
  await context.close();
});

test("status is never signalled by color alone", async ({ page }) => {
  await page.goto("/jobs");
  const pills = page.locator("[data-status]");
  const count = await pills.count();
  for (let i = 0; i < count; i++) {
    const text = (await pills.nth(i).innerText()).trim();
    expect(text.length).toBeGreaterThan(0);
  }
});
