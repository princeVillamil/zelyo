import "server-only";
import { Redis } from "ioredis";
import { env } from "./env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });

if (env.NODE_ENV !== "production") globalForRedis.redis = redis;
