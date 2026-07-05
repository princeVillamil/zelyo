import "server-only";

import type { ProofBundle } from "@zelyo/zk-shared";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  ContractError,
  explorerTxUrl,
  isRootValid,
  isNullifierUsed,
  submitVerifyAndRegister,
  submitRegister,
  verifyProofOffchain,
} from "@/lib/stellar";

export type VerificationResult =
  | "VERIFIED"
  | "INVALID_PROOF"
  | "UNKNOWN_ROOT"
  | "NULLIFIER_USED"
  | "ERROR";

export type VerifyResult = {
  ok: boolean;
  result: VerificationResult;
  txHash?: string;
  explorerUrl?: string;
};

function mapContractError(err: unknown): VerificationResult | null {
  if (err instanceof ContractError) {
    switch (err.contractError) {
      case "NullifierUsed":
        return "NULLIFIER_USED";
      case "UnknownRoot":
        return "UNKNOWN_ROOT";
      case "InvalidProof":
      case "AddressMismatch":
        return "INVALID_PROOF";
    }
  }
  return null;
}

async function mirror(
  bundle: ProofBundle,
  result: VerificationResult,
  txHash?: string,
  explorerUrl?: string,
  boundStellarAddress?: string,
  credentialId?: string,
  jobGateId?: string,
): Promise<void> {
  const { nullifier, scope, boundAddress, disclosed } = bundle.publicInputs;
  if (result === "VERIFIED" && txHash) {
    await db.nullifier.create({
      data: { nullifierHex: nullifier, scope, boundAddress, txHash },
    });
  }
  await db.verification.create({
    data: {
      nullifierHex: nullifier,
      disclosed: { value: disclosed.value, raw: disclosed.raw },
      boundAddress,
      boundStellarAddress: boundStellarAddress ?? null,
      result,
      txHash: txHash ?? null,
      explorerUrl: explorerUrl ?? null,
      credentialId: credentialId ?? null,
      jobGateId: jobGateId ?? null,
    },
  });
}

export interface VerifyAndRegisterInput extends ProofBundle {
  boundStellarAddress: string;
  credentialId?: string;
  jobGateId?: string;
}

export async function verifyAndRegister({
  boundStellarAddress,
  credentialId,
  jobGateId,
  ...bundle
}: VerifyAndRegisterInput): Promise<VerifyResult> {
  const { root, nullifier, disclosed } = bundle.publicInputs;
  const log = logger.child({ op: "verifyAndRegister" });

  const runMirror = (result: VerificationResult, txHash?: string, url?: string) =>
    mirror(bundle, result, txHash, url, boundStellarAddress, credentialId, jobGateId);

  try {
    // Fast fail: root must be in the valid set; nullifier must be unused (chain is authoritative,
    // but a cheap mirror/contract pre-check avoids a doomed submission).
    if (!(await isRootValid(root))) {
      await runMirror("UNKNOWN_ROOT");
      return { ok: false, result: "UNKNOWN_ROOT" };
    }
    if (await isNullifierUsed(nullifier)) {
      await runMirror("NULLIFIER_USED");
      return { ok: false, result: "NULLIFIER_USED" };
    }

    if (credentialId) {
      const credential = await db.credential.findUnique({
        where: { id: credentialId },
        include: { leaf: true },
      });
      if (!credential || credential.status !== "ACTIVE") {
        await runMirror("INVALID_PROOF");
        return { ok: false, result: "INVALID_PROOF" };
      }

      // Check 1: Verify disclosed attribute matches the credential's attribute.
      const credAttr = credential.attributes as Record<string, string>;
      if (disclosed.raw && typeof disclosed.raw === "object") {
        for (const [key, val] of Object.entries(disclosed.raw)) {
          if (credAttr[key] !== val) {
            await runMirror("INVALID_PROOF");
            return { ok: false, result: "INVALID_PROOF" };
          }
        }
      }

      // Check 2: Verify the credential's leaf index is within the Merkle tree at the proof's root
      const rootHistory = await db.rootHistory.findUnique({
        where: { rootHex: root },
      });
      if (!rootHistory) {
        await runMirror("UNKNOWN_ROOT");
        return { ok: false, result: "UNKNOWN_ROOT" };
      }

      const leafCountAtRoot = await db.leaf.count({
        where: { createdAt: { lte: rootHistory.publishedAt } },
      });
      if (credential.leafIndex >= leafCountAtRoot) {
        await runMirror("INVALID_PROOF");
        return { ok: false, result: "INVALID_PROOF" };
      }
    }

    let txHash: string;
    try {
      if (env.ZK_VERIFY_MODE === "server") {
        // Path B: verify the proof off-chain, then register the server-attested result.
        if (!(await verifyProofOffchain(bundle))) {
          await runMirror("INVALID_PROOF");
          return { ok: false, result: "INVALID_PROOF" };
        }
        ({ txHash } = await submitRegister(bundle.publicInputs, boundStellarAddress));
      } else {
        // Path A: contract verifies the proof on-chain then enforces the checks.
        ({ txHash } = await submitVerifyAndRegister(bundle));
      }
    } catch (err) {
      const mapped = mapContractError(err);
      if (mapped) {
        await runMirror(mapped);
        return { ok: false, result: mapped };
      }
      throw err;
    }

    const url = explorerTxUrl(txHash);
    await runMirror("VERIFIED", txHash, url);
    return { ok: true, result: "VERIFIED", txHash, explorerUrl: url };
  } catch (err) {
    log.error({ err }, "verifyAndRegister failed");
    return { ok: false, result: "ERROR" };
  }
}
