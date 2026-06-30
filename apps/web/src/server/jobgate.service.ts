import "server-only";
import { z } from "zod";
import type { FieldHex } from "@zelyo/zk-shared";
import { db } from "../lib/db";
import { issueClaimableBalance, setVerifiedFlag } from "../lib/stellar";
import { AppError } from "../lib/errors";

const predicateSchema = z.object({ attribute: z.string(), equals: z.string() });
const assetSchema = z.object({ code: z.string(), issuer: z.string(), amount: z.string() });
const rewardConfigSchema = z.object({ asset: assetSchema }).partial({ asset: true });

export type GateSummary = {
  slug: string;
  title: string;
  description: string;
  requiredPredicate: z.infer<typeof predicateSchema>;
  rewardType: string;
};
export type GateDetail = GateSummary & { id: string };

export async function listGates(): Promise<GateSummary[]> {
  const gates = await db.jobGate.findMany({ orderBy: { createdAt: "asc" } });
  return gates.map((g) => ({
    slug: g.slug,
    title: g.title,
    description: g.description,
    requiredPredicate: predicateSchema.parse(g.requiredPredicate),
    rewardType: g.rewardType,
  }));
}

export async function getGate(slug: string): Promise<GateDetail | null> {
  const g = await db.jobGate.findUnique({ where: { slug } });
  if (!g) return null;
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    description: g.description,
    requiredPredicate: predicateSchema.parse(g.requiredPredicate),
    rewardType: g.rewardType,
  };
}

/** SPEC §7.3: on a valid VERIFIED proof satisfying the gate predicate, issue the reward and record a GateClaim. */
export async function claimGate(
  slug: string,
  nullifierHex: FieldHex,
  boundAddress: string,
  txHash: string,
): Promise<{ txHash?: string; rewardType: string }> {
  const gate = await db.jobGate.findUnique({ where: { slug } });
  if (!gate) throw new AppError("GATE_NOT_FOUND", 404, "No such job gate.");

  const predicate = predicateSchema.parse(gate.requiredPredicate);

  const verification = await db.verification.findFirst({
    where: { txHash, nullifierHex, boundStellarAddress: boundAddress, result: "VERIFIED" },
    orderBy: { createdAt: "desc" },
  });
  if (!verification) {
    throw new AppError("PROOF_NOT_ELIGIBLE", 422, "No eligible verified proof for this gate.");
  }
  const disclosedRaw = (verification.disclosed as { raw?: Record<string, string> }).raw;
  if (!disclosedRaw || disclosedRaw[predicate.attribute] !== predicate.equals) {
    throw new AppError("PROOF_NOT_ELIGIBLE", 422, "The proof does not satisfy this gate.");
  }

  // Idempotent per (gate, nullifier) — the chain already blocks Sybil; this blocks double-issue.
  const existing = await db.gateClaim.findUnique({
    where: { jobGateId_nullifierHex: { jobGateId: gate.id, nullifierHex } },
  });
  if (existing) {
    return existing.txHash != null
      ? { txHash: existing.txHash, rewardType: gate.rewardType }
      : { rewardType: gate.rewardType };
  }

  let rewardTxHash: string;
  if (gate.rewardType === "CLAIMABLE_BALANCE") {
    const cfg = rewardConfigSchema.parse(gate.rewardConfig);
    if (!cfg.asset) throw new AppError("GATE_MISCONFIGURED", 500, "Gate reward asset missing.");
    ({ txHash: rewardTxHash } = await issueClaimableBalance(boundAddress, cfg.asset));
  } else if (gate.rewardType === "FLAG") {
    ({ txHash: rewardTxHash } = await setVerifiedFlag(boundAddress));
  } else {
    throw new AppError("GATE_MISCONFIGURED", 500, "Unknown reward type.");
  }

  await db.gateClaim.create({
    data: { jobGateId: gate.id, nullifierHex, boundAddress, txHash: rewardTxHash },
  });
  return { txHash: rewardTxHash, rewardType: gate.rewardType };
}
