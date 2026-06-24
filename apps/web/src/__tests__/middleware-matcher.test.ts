import { describe, it, expect, vi } from "vitest";

// Importing middleware evaluates NextAuth(authConfig); stub the runtime so the
// static `config` export can be asserted without next-auth resolving next/server.
vi.mock("next-auth", () => ({ default: () => ({ auth: (fn: unknown) => fn }) }));
vi.mock("next/server", () => ({
  NextResponse: { next: () => ({}), redirect: () => ({}) },
}));

const { config } = await import("../middleware");

describe("middleware matcher", () => {
  it("guards the protected route trees and skips static/api", () => {
    expect(config.matcher).toContain("/issuer/:path*");
    expect(config.matcher).toContain("/admin/:path*");
    expect(config.matcher).toContain("/wallet/:path*");
  });
});
