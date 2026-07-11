import "server-only";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "./redis";
import { AppError } from "./errors";

function make(keyPrefix: string, points: number) {
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration: 60, // per minute
  });
}

// SPEC §8 floors, per IP, per minute. `claim` covers the public job-board claim route.
export const limiters = {
  auth: make("rl:auth", 10),
  verify: make("rl:verify", 20),
  register: make("rl:register", 5),
  mint: make("rl:mint", 60),
  claim: make("rl:claim", 20),
  sep12: make("rl:sep12", 30),
  sep8: make("rl:sep8", 30),
  sep10: make("rl:sep10", 30),
  holderWallet: make("rl:holderWallet", 20),
};

export class RateLimitError extends AppError {
  constructor(public readonly retryAfter: number) {
    super("RATE_LIMITED", 429, "Too many requests. Please retry shortly.");
  }
}

export async function consumeOrThrow(
  limiter: RateLimiterRedis,
  key: string,
): Promise<void> {
  try {
    await limiter.consume(key, 1);
  } catch (res) {
    const ms = (res as { msBeforeNext?: number }).msBeforeNext ?? 60000;
    throw new RateLimitError(Math.ceil(ms / 1000));
  }
}

/** Enforce a named SPEC §8 limiter for a given IP. Throws RATE_LIMITED with retryAfter. */
export async function enforceRateLimit(
  name: keyof typeof limiters,
  ip: string,
): Promise<void> {
  await consumeOrThrow(limiters[name], ip);
}

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}

// Ad-hoc keyed limiter for handlers that don't use the named `limiters` above.
// Cached per (points,duration) so the RateLimiterRedis is reused.
const adHoc = new Map<string, RateLimiterRedis>();

export async function rateLimit(
  key: string,
  points: number,
  duration: number,
): Promise<{ ok: boolean; retryAfter: number }> {
  const cacheKey = `${points}:${duration}`;
  let limiter = adHoc.get(cacheKey);
  if (!limiter) {
    limiter = new RateLimiterRedis({ storeClient: redis, keyPrefix: `rl:${cacheKey}`, points, duration });
    adHoc.set(cacheKey, limiter);
  }
  try {
    await limiter.consume(key, 1);
    return { ok: true, retryAfter: 0 };
  } catch (res) {
    const ms = (res as { msBeforeNext?: number }).msBeforeNext ?? duration * 1000;
    return { ok: false, retryAfter: Math.ceil(ms / 1000) };
  }
}
