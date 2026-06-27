import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";
import { cspValue } from "../lib/security-headers";

describe("security headers", () => {
  it("declares COOP/COEP and the hardening headers globally", async () => {
    const groups = await nextConfig.headers!();
    const all = groups.find((g) => g.source === "/:path*");
    expect(all).toBeDefined();
    const map = Object.fromEntries(all!.headers.map((h) => [h.key, h.value]));
    expect(map["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(map["Cross-Origin-Embedder-Policy"]).toBe("require-corp");
    expect(map["X-Frame-Options"]).toBe("DENY");
    expect(map["X-Content-Type-Options"]).toBe("nosniff");
    expect(map["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(map["Permissions-Policy"]).toContain("camera=()");
    // CSP is emitted per-request by middleware (it needs a nonce), not here.
    expect(map["Content-Security-Policy"]).toBeUndefined();
  });

  it("prod CSP carries the nonce + strict-dynamic and forbids inline/eval scripts", () => {
    const csp = cspValue(true, "test-nonce");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain(
      "script-src 'self' 'wasm-unsafe-eval' 'nonce-test-nonce' 'strict-dynamic'",
    );
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("dev CSP relaxes inline/eval for the dev runtime", () => {
    const csp = cspValue(false);
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});
