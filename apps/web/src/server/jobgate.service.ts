import "server-only";
import { z } from "zod";
import type { FieldHex } from "@zelyo/zk-shared";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { issueClaimableBalance, issuePayment, issuePathPayment, issueSorobanAsset, setVerifiedFlag } from "../lib/stellar";
import { explorerTxUrl } from "../lib/explorer";
import { isContractAddress, isReceiveAssetChoice } from "../lib/stellar";
import type { AssetChoice } from "../lib/stellar";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

const predicateSchema = z.object({ attribute: z.string(), equals: z.string() });
const assetSchema = z.object({ code: z.string(), issuer: z.string(), amount: z.string() });
const rewardConfigSchema = z.object({ asset: assetSchema }).partial({ asset: true });

export type Predicate = z.infer<typeof predicateSchema>;

export type GateSummary = {
  slug: string;
  title: string;
  description: string;
  requiredPredicates: Predicate[];
  rewardType: string;
  expiresAt: string | null;
};
export type GateDetail = GateSummary & {
  id: string;
  rewardConfig: z.infer<typeof rewardConfigSchema>;
};

export async function listGates(): Promise<GateSummary[]> {
  const gates = await db.jobGate.findMany({ orderBy: { createdAt: "asc" } });
  return gates.map((g) => ({
    slug: g.slug,
    title: g.title,
    description: g.description,
    requiredPredicates: predicateSchema.array().parse(g.requiredPredicates),
    rewardType: g.rewardType,
    expiresAt: g.expiresAt?.toISOString() ?? null,
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
    requiredPredicates: predicateSchema.array().parse(g.requiredPredicates),
    rewardType: g.rewardType,
    rewardConfig: rewardConfigSchema.parse(g.rewardConfig),
    expiresAt: g.expiresAt?.toISOString() ?? null,
  };
}

export type CreateGateInput = {
  slug: string;
  title: string;
  description: string;
  requiredPredicates: Predicate[];
  rewardType: "CLAIMABLE_BALANCE" | "REGULATED_ASSET" | "FLAG";
  rewardConfig: z.infer<typeof rewardConfigSchema>;
  expiresAt: string | null;
};

export async function createGate(input: CreateGateInput): Promise<GateDetail> {
  const existing = await db.jobGate.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError("GATE_SLUG_TAKEN", 409, "Slug already in use.");

  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    const parsed = new Date(input.expiresAt);
    if (input.expiresAt.length === 10) {
      parsed.setHours(23, 59, 59, 999);
    }
    expiresAt = parsed;
  }

  if (input.rewardType === "REGULATED_ASSET") {
    const cfg = rewardConfigSchema.parse(input.rewardConfig);
    if (!cfg.asset) {
      throw new AppError("GATE_MISCONFIGURED", 400, "REGULATED_ASSET reward requires an asset.");
    }
    if (cfg.asset.issuer !== env.ISSUER_STELLAR_ACCOUNT) {
      throw new AppError(
        "GATE_MISCONFIGURED",
        400,
        "REGULATED_ASSET reward must use an asset issued by the Zelyo issuer account.",
      );
    }
  }

  const gate = await db.jobGate.create({
    data: {
      slug: input.slug,
      title: input.title,
      description: input.description,
      requiredPredicates: input.requiredPredicates,
      rewardType: input.rewardType,
      rewardConfig: input.rewardConfig,
      expiresAt,
    },
  });
  return {
    id: gate.id,
    slug: gate.slug,
    title: gate.title,
    description: gate.description,
    requiredPredicates: predicateSchema.array().parse(gate.requiredPredicates),
    rewardType: gate.rewardType,
    rewardConfig: rewardConfigSchema.parse(gate.rewardConfig),
    expiresAt: gate.expiresAt?.toISOString() ?? null,
  };
}

/** SPEC §7.3: on a valid VERIFIED proof satisfying the gate predicate, issue the reward and record a GateClaim. */
export async function claimGate(
  slug: string,
  nullifierHex: FieldHex,
  boundAddress: string,
  txHash: string,
  receiveAsset?: AssetChoice,
): Promise<{ txHash?: string; explorerUrl?: string; rewardType: string }> {
  const gate = await db.jobGate.findUnique({ where: { slug } });
  if (!gate) throw new AppError("GATE_NOT_FOUND", 404, "No such job gate.");

  if (gate.expiresAt && new Date() > gate.expiresAt) {
    throw new AppError("GATE_EXPIRED", 410, "This gate has expired.");
  }

  const predicates = predicateSchema.array().parse(gate.requiredPredicates);

  const verification = await db.verification.findFirst({
    where: { txHash, nullifierHex, boundStellarAddress: boundAddress, result: "VERIFIED" },
    orderBy: { createdAt: "desc" },
  });
  if (!verification) {
    throw new AppError("PROOF_NOT_ELIGIBLE", 422, "No eligible verified proof for this gate.");
  }
  if (verification.jobGateId && verification.jobGateId !== gate.id) {
    throw new AppError("PROOF_NOT_ELIGIBLE", 422, "This proof was verified for a different gate.");
  }
  const disclosedRaw = (verification.disclosed as { raw?: Record<string, string> }).raw ?? {};

  // A gate can only enforce a predicate on an attribute the proof actually disclosed —
  // an undisclosed attribute is unproven, so requiring it to be disclosed is the secure
  // behavior. Surface exactly which attributes are missing so the holder can re-prove.
  const missing = predicates.filter((p) => !(p.attribute in disclosedRaw));
  if (missing.length > 0) {
    throw new AppError(
      "PROOF_NOT_ELIGIBLE",
      422,
      `This gate requires disclosing: ${missing.map((p) => p.attribute).join(", ")}. Re-prove and reveal all required attributes.`,
    );
  }
  const unsatisfied = predicates.filter((p) => disclosedRaw[p.attribute] !== p.equals);
  if (unsatisfied.length > 0) {
    throw new AppError("PROOF_NOT_ELIGIBLE", 422, "The proof does not satisfy this gate.");
  }

  // The chain's nullifier registry already blocks Sybil re-use; the
  // @@unique([jobGateId, nullifierHex]) constraint blocks double-issue. Surface the
  // rejection explicitly — a second claim is an error the holder should SEE, not a
  // silent repeat success.
  const existing = await db.gateClaim.findUnique({
    where: { jobGateId_nullifierHex: { jobGateId: gate.id, nullifierHex } },
  });
  if (existing) {
    throw new AppError(
      "ALREADY_CLAIMED",
      409,
      `This proof already claimed its reward on ${existing.createdAt.toLocaleDateString()}. One proof, one reward — the second claim was rejected.`,
      existing.txHash
        ? {
            txHash: existing.txHash,
            explorerUrl: explorerTxUrl(existing.txHash),
            claimedAt: existing.createdAt.toISOString(),
          }
        : { claimedAt: existing.createdAt.toISOString() },
    );
  }

  let rewardTxHash: string;
  const sponsor = env.USE_CHANNELS ? ("channels" as const) : undefined;
  const sponsorArgs = sponsor ? [{ sponsor }] : [];
  try {
    if (gate.rewardType === "CLAIMABLE_BALANCE" || gate.rewardType === "REGULATED_ASSET") {
      const cfg = rewardConfigSchema.parse(gate.rewardConfig);
      if (!cfg.asset) throw new AppError("GATE_MISCONFIGURED", 500, "Gate reward asset missing.");
      if (receiveAsset) {
        // Holder chose a different receive asset — convert the issuer's XLM via the
        // SDEX with a strict-send path payment. Guarded: XLM-funded gates only,
        // whitelisted assets only, classic wallets only (SAC has no path payments).
        const isXlmGate = cfg.asset.code === "XLM" && !cfg.asset.issuer;
        if (!isXlmGate) {
          throw new AppError("ASSET_CHOICE_UNSUPPORTED", 422, "Asset choice is only available for XLM rewards.");
        }
        if (!isReceiveAssetChoice(receiveAsset)) {
          throw new AppError("ASSET_CHOICE_UNSUPPORTED", 422, "That receive asset is not supported.");
        }
        if (isContractAddress(boundAddress)) {
          throw new AppError("ASSET_CHOICE_UNSUPPORTED", 422, "Asset choice requires a classic Stellar wallet (G… address).");
        }
        if (receiveAsset.code === "XLM" && !receiveAsset.issuer) {
          ({ txHash: rewardTxHash } = await issuePayment(boundAddress, cfg.asset, ...sponsorArgs));
        } else {
          ({ txHash: rewardTxHash } = await issuePathPayment(boundAddress, cfg.asset, receiveAsset, ...sponsorArgs));
        }
      } else if (isContractAddress(boundAddress)) {
        // Soroban smart wallets (C...) cannot receive classic payments or claimable
        // balances, so route them through the asset's Stellar Asset Contract instead.
        ({ txHash: rewardTxHash } = await issueSorobanAsset(boundAddress, cfg.asset, ...sponsorArgs));
      } else {
        // Native XLM (empty issuer) lands immediately via direct payment. Custom assets
        // still use claimable balances; a holder-signed claim step could be added later.
        const isNativeXlm = cfg.asset.code === "XLM" && !cfg.asset.issuer;
        ({ txHash: rewardTxHash } = isNativeXlm
          ? await issuePayment(boundAddress, cfg.asset, ...sponsorArgs)
          : await issueClaimableBalance(boundAddress, cfg.asset, ...sponsorArgs));
      }
    } else if (gate.rewardType === "FLAG") {
      ({ txHash: rewardTxHash } = await setVerifiedFlag(boundAddress, ...sponsorArgs));
    } else {
      throw new AppError("GATE_MISCONFIGURED", 500, "Unknown reward type.");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // The reward tx failed on-chain (unfunded issuer, low reserve, etc.). Log the real
    // cause server-side and surface the Horizon/Soroban result codes instead of a blank 500.
    const detail = stellarErrorDetail(err);
    logger.error({ err, gate: slug, boundAddress, detail }, "gate reward issuance failed");
    throw new AppError("REWARD_FAILED", 502, `Reward issuance failed: ${detail}`);
  }

  await db.gateClaim.create({
    data: { jobGateId: gate.id, nullifierHex, boundAddress, txHash: rewardTxHash },
  });
  return { txHash: rewardTxHash, explorerUrl: explorerTxUrl(rewardTxHash), rewardType: gate.rewardType };
}

/** Pull a readable cause out of a Horizon/Soroban error (result codes preferred). */
function stellarErrorDetail(err: unknown): string {
  const e = err as {
    response?: { data?: { title?: string; extras?: { result_codes?: unknown } } };
    message?: string;
  };
  const codes = e?.response?.data?.extras?.result_codes;
  if (codes) return JSON.stringify(codes);
  return e?.response?.data?.title ?? e?.message ?? "unknown error";
}
