import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// Fails the test on any serious/critical WCAG 2 A/AA violation (BRAND.md §10).
export async function checkA11y(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious,
    `axe violations on ${context}: ${JSON.stringify(serious.map((v) => v.id))}`,
  ).toEqual([]);
}
