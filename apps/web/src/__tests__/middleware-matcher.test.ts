import { describe, it, expect, vi } from "vitest";

// Importing middleware evaluates NextAuth(authConfig); stub the runtime so the
// static `config` export can be asserted without next-auth resolving next/server.
vi.mock("next-auth", () => ({ default: () => ({ auth: (fn: unknown) => fn }) }));
vi.mock("next/server", () => ({
  NextResponse: { next: () => ({}), redirect: () => ({}) },
}));

const { config } = await import("../middleware");

describe("middleware matcher", () => {
  it("runs on every document route so the CSP nonce is always set, but skips api/static", () => {
    // The middleware now also emits the per-request CSP nonce, so it must run on
    // all document routes (role guards live in the handler, not the matcher).
    const pattern = (config.matcher as string[])[0];
    expect(pattern).toContain("(?!");
    for (const skip of ["api", "_next/static", "_next/image", "favicon.ico", "circuit"]) {
      expect(pattern).toContain(skip);
    }
  });
});
