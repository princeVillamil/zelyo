// @vitest-environment node
// (reads globals.css from disk; jsdom's import.meta.url is not a file: URL)
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(
  fileURLToPath(new URL("../app/globals.css", import.meta.url)),
  "utf8",
);

describe("globals.css @theme", () => {
  it("imports tailwind + the forms plugin", () => {
    expect(css).toContain('@import "tailwindcss"');
    expect(css).toContain('@plugin "@tailwindcss/forms"');
  });

  it("defines the full BRAND.md §2 color set verbatim", () => {
    const expected: Record<string, string> = {
      "--color-background": "#fbf9f5",
      "--color-surface": "#fbf9f5",
      "--color-surface-bright": "#fbf9f5",
      "--color-on-background": "#1b1c1a",
      "--color-on-surface": "#1b1c1a",
      "--color-on-surface-variant": "#424846",
      "--color-primary": "#051a17",
      "--color-on-primary": "#ffffff",
      "--color-primary-container": "#1a2f2b",
      "--color-on-primary-container": "#809792",
      "--color-primary-fixed": "#d0e8e1",
      "--color-primary-fixed-dim": "#b4ccc5",
      "--color-inverse-primary": "#b4ccc5",
      "--color-secondary": "#635e56",
      "--color-secondary-container": "#eae1d7",
      "--color-secondary-fixed-dim": "#cdc5bc",
      "--color-tertiary": "#25120b",
      "--color-tertiary-container": "#3c261e",
      "--color-tertiary-fixed": "#ffdbcf",
      "--color-surface-container-lowest": "#ffffff",
      "--color-surface-container-low": "#f5f3ef",
      "--color-surface-container": "#efeeea",
      "--color-surface-container-high": "#eae8e4",
      "--color-surface-container-highest": "#e4e2de",
      "--color-surface-variant": "#e4e2de",
      "--color-surface-dim": "#dbdad6",
      "--color-outline": "#727876",
      "--color-outline-variant": "#c2c8c5",
      "--color-error": "#ba1a1a",
      "--color-error-container": "#ffdad6",
      "--color-inverse-surface": "#30312e",
      "--color-inverse-on-surface": "#f2f0ed",
    };
    for (const [k, v] of Object.entries(expected)) {
      expect(css, `${k}`).toContain(`${k}: ${v};`);
    }
  });

  it("defines fonts, type scale, spacing, and the radius-full override", () => {
    expect(css).toContain('--font-display: "EB Garamond"');
    expect(css).toContain('--font-body: "Source Serif 4"');
    expect(css).toContain('--font-label: "Hanken Grotesk"');
    expect(css).toContain("--text-display-lg: 48px;");
    expect(css).toContain("--text-display-lg--letter-spacing: -0.02em;");
    expect(css).toContain("--spacing-margin-page: 64px;");
    expect(css).toContain("--radius-full: 0.75rem;");
  });

  it("defines the signature utilities + reduced-motion guard", () => {
    expect(css).toContain(".foil-stamp");
    expect(css).toContain("@keyframes shine");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(".ledger-line");
    expect(css).toContain(".manuscript-glow");
    expect(css).toContain(".typewriter");
  });

  it("self-hosts fonts with font-display: swap", () => {
    expect(css).toContain("@font-face");
    expect(css).toContain("font-display: swap;");
  });
});
