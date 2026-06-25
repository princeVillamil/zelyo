import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";

/** Append-only audit entry. Never store PII values in `meta` — hashes/txHashes only. */
export async function audit(
  action: string,
  opts: {
    target?: string;
    ip?: string;
    meta?: Record<string, unknown>;
    actorUserId?: string;
  } = {},
): Promise<void> {
  await db.auditLog.create({
    data: {
      action,
      target: opts.target ?? null,
      ip: opts.ip ?? null,
      actorUserId: opts.actorUserId ?? null,
      meta: (opts.meta ?? {}) as Prisma.InputJsonValue,
    },
  });
}
