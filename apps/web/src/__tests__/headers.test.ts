import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

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
    expect(map["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(map["Content-Security-Policy"]).not.toContain("unsafe-inline 'self' 'unsafe-inline' script");
    expect(map["Permissions-Policy"]).toContain("camera=()");
  });
});
