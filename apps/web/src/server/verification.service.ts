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
    },
  });
}

export interface VerifyAndRegisterInput extends ProofBundle {
  boundStellarAddress: string;
}

export async function verifyAndRegister({
  boundStellarAddress,
  ...bundle
}: VerifyAndRegisterInput): Promise<VerifyResult> {
  const { root, nullifier } = bundle.publicInputs;
  const log = logger.child({ op: "verifyAndRegister" });

  try {
    // Fast fail: root must be in the valid set; nullifier must be unused (chain is authoritative,
    // but a cheap mirror/contract pre-check avoids a doomed submission).
    if (!(await isRootValid(root))) {
      await mirror(bundle, "UNKNOWN_ROOT", undefined, undefined, boundStellarAddress);
      return { ok: false, result: "UNKNOWN_ROOT" };
    }
    if (await isNullifierUsed(nullifier)) {
      await mirror(bundle, "NULLIFIER_USED", undefined, undefined, boundStellarAddress);
      return { ok: false, result: "NULLIFIER_USED" };
    }

    let txHash: string;
    try {
      if (env.ZK_VERIFY_MODE === "server") {
        // Path B: verify the proof off-chain, then register the server-attested result.
        if (!(await verifyProofOffchain(bundle))) {
          await mirror(bundle, "INVALID_PROOF", undefined, undefined, boundStellarAddress);
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
        await mirror(bundle, mapped, undefined, undefined, boundStellarAddress);
        return { ok: false, result: mapped };
      }
      throw err;
    }

    const url = explorerTxUrl(txHash);
    await mirror(bundle, "VERIFIED", txHash, url, boundStellarAddress);
    return { ok: true, result: "VERIFIED", txHash, explorerUrl: url };
  } catch (err) {
    log.error({ err }, "verifyAndRegister failed");
    return { ok: false, result: "ERROR" };
  }
}
