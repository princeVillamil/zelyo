import "server-only";
import type { VerificationResult } from "@prisma/client";
import { db } from "../lib/db";
import { explorerTxUrl } from "../lib/explorer";

export type VerificationView = {
  txHash: string;
  result: VerificationResult;
  nullifierHex: string;
  rootHex: string | null;
  rootAnchorTxHash: string | null;
  boundAddress: string;
  boundStellarAddress: string | null;
  disclosed: unknown;
  disclosedRaw: Record<string, string>;
  explorerUrl: string;
  createdAt: Date;
  jobGateSlug: string | null;
  jobGateTitle: string | null;
  credentialId: string | null;
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
      rootHex: true,
      boundAddress: true,
      boundStellarAddress: true,
      disclosed: true,
      createdAt: true,
      credentialId: true,
      jobGate: { select: { slug: true, title: true } },
    },
  });
  if (!row || row.txHash === null) return null;

  const disclosedRaw = (row.disclosed as { raw?: Record<string, string> }).raw ?? {};

  // The root that anchored this proof may itself have an on-chain publish tx —
  // surface it so the receipt can link both anchors (root + verification).
  let rootAnchorTxHash: string | null = null;
  if (row.rootHex) {
    const rootRow = await db.rootHistory.findUnique({
      where: { rootHex: row.rootHex },
      select: { txHash: true },
    });
    rootAnchorTxHash = rootRow?.txHash ?? null;
  }

  return {
    txHash: row.txHash,
    result: row.result,
    nullifierHex: row.nullifierHex,
    rootHex: row.rootHex,
    rootAnchorTxHash,
    boundAddress: row.boundAddress,
    boundStellarAddress: row.boundStellarAddress,
    disclosed: row.disclosed,
    disclosedRaw,
    explorerUrl: explorerTxUrl(row.txHash),
    createdAt: row.createdAt,
    jobGateSlug: row.jobGate?.slug ?? null,
    jobGateTitle: row.jobGate?.title ?? null,
    credentialId: row.credentialId,
  };
}
