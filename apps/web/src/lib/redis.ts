import "server-only";
import { Redis } from "ioredis";
import { env } from "./env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });

if (env.NODE_ENV !== "production") globalForRedis.redis = redis;

// A fresh connection for SUBSCRIBE (a subscribed ioredis client can't issue other
// commands). Callers must quit() it when done.
export function redisSubscriber(): Redis {
  return redis.duplicate();
}
