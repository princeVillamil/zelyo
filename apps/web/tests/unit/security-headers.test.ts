import { describe, it, expect } from "vitest";
import { securityHeaders, cspValue } from "../../src/lib/security-headers";

function asMap(isProd: boolean) {
  return new Map(securityHeaders(isProd).map((h) => [h.key, h.value]));
}

describe("security headers", () => {
  it("sets the cross-cutting headers AGENT.md §4 requires", () => {
    const h = asMap(true);
    expect(h.get("X-Frame-Options")).toBe("DENY");
    expect(h.get("X-Content-Type-Options")).toBe("nosniff");
    expect(h.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(h.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(h.get("Cross-Origin-Embedder-Policy")).toBe("require-corp");
    expect(h.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    );
  });

  it("emits HSTS only in production", () => {
    expect(asMap(true).get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(asMap(false).has("Strict-Transport-Security")).toBe(false);
  });

  it("CSP has no unsafe-inline for scripts and self-only font/style", () => {
    const csp = cspValue(true);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    // wasm-unsafe-eval is required for bb.js; the unsafe-eval source itself is forbidden.
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    // bb.js WASM needs SharedArrayBuffer; worker-src self+blob, wasm-unsafe-eval allowed
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("wasm-unsafe-eval");
  });
});
