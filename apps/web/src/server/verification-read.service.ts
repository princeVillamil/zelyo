import "server-only";
import type { VerificationResult } from "@prisma/client";
import { db } from "../lib/db";
import { explorerTxUrl } from "../lib/explorer";

export type VerificationView = {
  txHash: string;
  result: VerificationResult;
  nullifierHex: string;
  boundAddress: string;
  disclosed: unknown;
  explorerUrl: string;
  createdAt: Date;
  jobGateSlug: string | null;
};

/** Read-only lookup for the /verify/result/[txHash] reveal panel. Never touches the chain. */
export async function getVerificationByTxHash(
  txHash: string,
): Promise<VerificationView | null> {
  const row = await db.verification.findFirst({
    where: { txHash },
    orderBy: { createdAt: "desc" },
    select: {
      txHash: true,
      result: true,
      nullifierHex: true,
      boundAddress: true,
      disclosed: true,
      createdAt: true,
      jobGate: { select: { slug: true } },
    },
  });
  if (!row || row.txHash === null) return null;
  return {
    txHash: row.txHash,
    result: row.result,
    nullifierHex: row.nullifierHex,
    boundAddress: row.boundAddress,
    disclosed: row.disclosed,
    explorerUrl: explorerTxUrl(row.txHash),
    createdAt: row.createdAt,
    jobGateSlug: row.jobGate?.slug ?? null,
  };
}
