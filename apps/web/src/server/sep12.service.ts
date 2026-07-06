import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { FieldHex } from "@zelyo/zk-shared";

/**
 * SEP-12 customer status values.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0012.md
 */
export type Sep12Status = "NEEDS_INFO" | "ACCEPTED" | "PROCESSING" | "REJECTED";

export interface Sep12Field {
  description: string;
  type: string;
  status?: "VERIFICATION_REQUIRED" | "ACCEPTED";
  optional?: boolean;
}

export interface Sep12ProvidedField {
  description: string;
  type: string;
  status: "ACCEPTED" | "REJECTED" | "VERIFICATION_REQUIRED";
}

export interface Sep12CustomerResponse {
  id: string;
  status: Sep12Status;
  fields?: Record<string, Sep12Field>;
  provided_fields?: Record<string, Sep12ProvidedField>;
}

const stellarAddress = z.string().regex(/^G[A-Z2-7]{55}$/);

export const getCustomerQuerySchema = z
  .object({
    id: z.string().optional(),
    account: stellarAddress.optional(),
    memo: z.string().optional(),
    memo_type: z.string().optional(),
  })
  .refine((data) => data.id || data.account, {
    message: "Either 'id' or 'account' is required",
    path: ["id"],
  });

export const putCustomerBodySchema = z
  .object({
    id: z.string().optional(),
    account: stellarAddress,
    memo: z.string().optional(),
    memo_type: z.string().optional(),
    verification_id: z.string().optional(),
    // SEP-12 allows arbitrary fields; we ignore PII fields because Zelyo
    // never stores identity attributes. Anchors should only need the
    // verification_id to prove KYC status.
  })
  .passthrough();

/**
 * Look up a SEP-12 customer by id or Stellar account (+ optional memo).
 * Returns NEEDS_INFO if no ACCEPTED verification exists for the account.
 */
export async function getCustomer(
  query: z.infer<typeof getCustomerQuerySchema>,
): Promise<Sep12CustomerResponse> {
  const customer = query.id
    ? await db.sep12Customer.findUnique({ where: { id: query.id } })
    : await findCustomerByAccount(query.account!, query.memo);

  if (!customer) {
    // No customer record yet — anchor must PUT a verification first.
    return {
      id: "pending",
      status: "NEEDS_INFO",
      fields: {
        verification_id: {
          description: "Zelyo verification transaction id or uuid proving KYC status",
          type: "string",
          status: "VERIFICATION_REQUIRED",
        },
      },
    };
  }

  if (customer.status === "ACCEPTED") {
    return {
      id: customer.id,
      status: "ACCEPTED",
      provided_fields: {
        verification_id: {
          description: "Zelyo verification transaction id or uuid proving KYC status",
          type: "string",
          status: "ACCEPTED",
        },
      },
    };
  }

  return {
    id: customer.id,
    status: customer.status as Sep12Status,
    fields: {
      verification_id: {
        description: "Zelyo verification transaction id or uuid proving KYC status",
        type: "string",
        status: "VERIFICATION_REQUIRED",
      },
    },
  };
}

/**
 * Create or update a SEP-12 customer record using a Zelyo ZK verification.
 * The verification must be VERIFIED and bound to the same Stellar account.
 */
export async function putCustomer(
  body: z.infer<typeof putCustomerBodySchema>,
): Promise<Sep12CustomerResponse> {
  const { account, memo, memo_type, verification_id } = body;

  // If the anchor passed a verification_id, validate it now.
  if (verification_id) {
    const verification = await db.verification.findUnique({
      where: { id: verification_id },
    });

    if (!verification || verification.result !== "VERIFIED") {
      throw new AppError("INVALID_VERIFICATION", 422, "Verification not found or not VERIFIED.");
    }

    if (verification.boundStellarAddress !== account) {
      throw new AppError(
        "ADDRESS_MISMATCH",
        422,
        "Verification is bound to a different Stellar account.",
      );
    }

    const existing = await findCustomerByAccount(account, memo);

    const customer = await db.sep12Customer.upsert({
      where: existing ? { id: existing.id } : { stellarAccount: account },
      create: {
        stellarAccount: account,
        memo: memo ?? null,
        memoType: memo_type ?? null,
        status: "ACCEPTED",
        verificationId: verification.id,
      },
      update: {
        status: "ACCEPTED",
        verificationId: verification.id,
        memo: memo ?? null,
        memoType: memo_type ?? null,
      },
    });

    return {
      id: customer.id,
      status: "ACCEPTED",
      provided_fields: {
        verification_id: {
          description: "Zelyo verification transaction id or uuid proving KYC status",
          type: "string",
          status: "ACCEPTED",
        },
      },
    };
  }

  // No verification provided — return NEEDS_INFO with the required field.
  const existing = await findCustomerByAccount(account, memo);
  if (existing) {
    return {
      id: existing.id,
      status: existing.status as Sep12Status,
      fields: {
        verification_id: {
          description: "Zelyo verification transaction id or uuid proving KYC status",
          type: "string",
          status: "VERIFICATION_REQUIRED",
        },
      },
    };
  }

  // Create a NEEDS_INFO record so the anchor has a stable customer id.
  const customer = await db.sep12Customer.create({
    data: {
      stellarAccount: account,
      memo: memo ?? null,
      memoType: memo_type ?? null,
      status: "NEEDS_INFO",
    },
  });

  return {
    id: customer.id,
    status: "NEEDS_INFO",
    fields: {
      verification_id: {
        description: "Zelyo verification transaction id or uuid proving KYC status",
        type: "string",
        status: "VERIFICATION_REQUIRED",
      },
    },
  };
}

async function findCustomerByAccount(
  account: string,
  memo?: string,
): Promise<{ id: string; status: string; memo: string | null; memoType: string | null } | null> {
  // For shared accounts, memo disambiguates customers. For standard accounts,
  // memo is null/empty.
  const customers = await db.sep12Customer.findMany({
    where: { stellarAccount: account },
    orderBy: { createdAt: "desc" },
  });

  if (customers.length === 0) return null;

  // Match by memo if provided; otherwise return the first non-memo customer.
  if (memo !== undefined) {
    const match = customers.find((c) => c.memo === memo);
    if (match) return match;
  }

  const noMemo = customers.find((c) => !c.memo);
  return noMemo ?? customers[0] ?? null;
}
