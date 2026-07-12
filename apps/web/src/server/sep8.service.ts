import "server-only";
import { z } from "zod";
import { TransactionBuilder, FeeBumpTransaction, Asset } from "@stellar/stellar-sdk";
import type { Operation } from "@stellar/stellar-sdk";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { signTransactionEnvelope } from "@/lib/stellar";

export const approveTransactionBodySchema = z.object({
  tx: z.string().min(1, "Transaction envelope (base64 XDR) is required."),
});

export type Sep8ApproveResult =
  | { status: "approved"; tx: string }
  | { status: "rejected"; error: string };

/**
 * SEP-8 approval server entry point.
 *
 * Parses a base64 transaction envelope, inspects payment operations for the
 * Zelyo-regulated asset, and checks that every destination has a VERIFIED
 * Zelyo proof. If so, the transaction is co-signed with ISSUER_SECRET and
 * returned. If not, a SEP-8 rejection response is returned.
 */
export async function approveTransaction(
  body: z.infer<typeof approveTransactionBodySchema>,
): Promise<Sep8ApproveResult> {
  let tx;
  try {
    tx = TransactionBuilder.fromXDR(body.tx, env.NETWORK_PASSPHRASE);
  } catch {
    throw new AppError("INVALID_INPUT", 400, "Invalid transaction envelope.");
  }

  if (tx instanceof FeeBumpTransaction) {
    return { status: "rejected", error: "Fee-bump transactions are not supported for SEP-8 approval." };
  }

  const destinations = new Set<string>();

  for (const op of tx.operations) {
    if (op.type !== "payment") {
      return { status: "rejected", error: "Only payment operations are supported." };
    }

    const payment = op as Operation.Payment;
    const asset = payment.asset;

    // Native XLM is not a regulated asset; skip it.
    if (asset instanceof Asset && asset.isNative()) {
      continue;
    }

    if (!(asset instanceof Asset) || asset.getIssuer() !== env.ISSUER_STELLAR_ACCOUNT) {
      return { status: "rejected", error: "Transaction includes a non-Zelyo-regulated asset." };
    }

    destinations.add(payment.destination);
  }

  if (destinations.size === 0) {
    return { status: "rejected", error: "No regulated asset payment found." };
  }

  for (const address of destinations) {
    const verification = await db.verification.findFirst({
      where: { boundStellarAddress: address, result: "VERIFIED" },
      orderBy: { createdAt: "desc" },
    });
    if (!verification) {
      return { status: "rejected", error: "Destination is not Zelyo-verified." };
    }
  }

  const signedTx = signTransactionEnvelope(body.tx);
  return { status: "approved", tx: signedTx };
}
