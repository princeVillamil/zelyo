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

export const limiters = {
  auth: make("rl:auth", 10),
  verify: make("rl:verify", 20),
  register: make("rl:register", 5),
  mint: make("rl:mint", 60),
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

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}
