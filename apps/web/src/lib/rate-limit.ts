// Canonical re-export for the rate-limiting API consumed by handlers and tests.
// The original module lives in ratelimit.ts for backward compatibility.
export {
  limiters,
  RateLimitError,
  consumeOrThrow,
  enforceRateLimit,
  clientIp,
  rateLimit,
} from "./ratelimit";
