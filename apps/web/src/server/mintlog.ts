import "server-only";
import { redis } from "@/lib/redis";

export type MintLogEvent = {
  ts: string;
  event: string;
  status: "OK" | "PENDING" | "FAIL";
  detail?: string;
};

export function mintLogChannel(jobId: string): string {
  return `zelyo:mintlog:${jobId}`;
}

export function mintLogHistoryKey(jobId: string): string {
  return `zelyo:mintlog-history:${jobId}`;
}

// detail must NEVER contain attributes/PII — callers pass only ids/hashes/tx refs.
export async function publishMintLog(jobId: string, e: Omit<MintLogEvent, "ts">): Promise<void> {
  const event: MintLogEvent = { ts: new Date().toISOString(), ...e };
  const payload = JSON.stringify(event);

  const key = mintLogHistoryKey(jobId);
  await redis.rpush(key, payload);
  await redis.expire(key, 300); // 5 minutes TTL

  await redis.publish(mintLogChannel(jobId), payload);
}

export function formatMintLine(e: MintLogEvent): string {
  const t = new Date(e.ts).toISOString().slice(11, 19); // HH:MM:SS
  const tail = e.detail ? `  ${e.detail}` : "";
  return `[${t}] ${e.event} … ${e.status}${tail}`;
}
