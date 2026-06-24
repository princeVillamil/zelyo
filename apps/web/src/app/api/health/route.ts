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
  const allOk = dbOk && redisOk && rpcOk;
  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks },
    { status: allOk ? 200 : 503 },
  );
}
