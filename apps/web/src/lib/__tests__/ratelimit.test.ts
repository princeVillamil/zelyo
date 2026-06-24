import { describe, it, expect, vi } from "vitest";

vi.mock("../redis", () => ({ redis: {} }));
vi.mock("rate-limiter-flexible", () => {
  class RateLimiterRedis {
    points: number;
    constructor(opts: { points: number }) { this.points = opts.points; }
    async consume() { throw { msBeforeNext: 30000 }; } // simulate exhaustion
  }
  return { RateLimiterRedis };
});

describe("ratelimit", () => {
  it("configures floors and throws AppError 429 on exhaustion", async () => {
    const { limiters, consumeOrThrow } = await import("../ratelimit");
    expect((limiters.auth as unknown as { points: number }).points).toBe(10);
    expect((limiters.verify as unknown as { points: number }).points).toBe(20);
    expect((limiters.register as unknown as { points: number }).points).toBe(5);
    expect((limiters.mint as unknown as { points: number }).points).toBe(60);

    await expect(consumeOrThrow(limiters.register, "1.2.3.4")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      httpStatus: 429,
    });
  });

  it("extracts the client IP", async () => {
    const { clientIp } = await import("../ratelimit");
    const h = new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" });
    expect(clientIp(h)).toBe("9.9.9.9");
  });
});
