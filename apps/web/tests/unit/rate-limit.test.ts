import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory limiter so the test needs no Redis.
vi.mock("rate-limiter-flexible", async () => {
  const actual = await vi.importActual<typeof import("rate-limiter-flexible")>(
    "rate-limiter-flexible",
  );
  return { ...actual, RateLimiterRedis: actual.RateLimiterMemory };
});
vi.mock("../../src/lib/redis", () => ({ redis: {} }));

import { limiters, enforceRateLimit } from "../../src/lib/rate-limit";

describe("rate limit floors (SPEC §8)", () => {
  it("declares the SPEC §8 per-minute floors", () => {
    expect(limiters.auth.points).toBe(10);
    expect(limiters.verify.points).toBe(20);
    expect(limiters.register.points).toBe(5);
    expect(limiters.mint.points).toBe(60);
    expect(limiters.claim.points).toBeGreaterThan(0);
    for (const l of Object.values(limiters)) expect(l.duration).toBe(60);
  });

  it("throws RATE_LIMITED with Retry-After once the floor is exceeded", async () => {
    const ip = "203.0.113.7";
    for (let i = 0; i < 5; i++) await enforceRateLimit("register", ip); // 5/min OK
    let caught: unknown;
    try {
      await enforceRateLimit("register", ip); // 6th in window
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeTruthy();
    const err = caught as { code: string; httpStatus: number; retryAfter: number };
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.httpStatus).toBe(429);
    expect(err.retryAfter).toBeGreaterThan(0);
  });
});
