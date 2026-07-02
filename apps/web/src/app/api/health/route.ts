import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { rpcServer } from "@/lib/stellar";

export const dynamic = "force-dynamic";

async function check(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [dbOk, redisOk, rpcOk] = await Promise.all([
    check(() => db.$queryRaw`SELECT 1`),
    check(() => redis.ping()),
    check(() => rpcServer.getHealth()),
  ]);
  const checks = { db: dbOk, redis: redisOk, rpc: rpcOk };
  // Railway uses this endpoint as a deployment healthcheck. DB + Redis are
  // required for the app to function; an external Soroban RPC outage should
  // not restart the container.
  const coreOk = dbOk && redisOk;
  const status = coreOk && rpcOk ? "ok" : "degraded";
  return NextResponse.json({ status, checks }, { status: coreOk ? 200 : 503 });
}
