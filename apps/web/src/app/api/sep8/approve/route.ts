import { z } from "zod";
import { NextResponse } from "next/server";
import {
  approveTransaction,
  approveTransactionBodySchema,
} from "@/server/sep8.service";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";
import { AppError, toErrorResponse } from "@/lib/errors";
import { audit } from "@/lib/audit";

/**
 * SEP-8 approval server endpoint.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md
 *
 * POST /api/sep8/approve { tx: "base64 XDR envelope" }
 *
 * Returns a SEP-8 response:
 *   { status: "approved", tx: "signed base64 XDR" }
 *   { status: "rejected", error: "..." }
 *
 * HTTP 200 is used for both approved and rejected SEP-8 outcomes.
 * HTTP 4xx/5xx is reserved for malformed input, rate limits, and internal errors.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.sep8, ip);

    const body: unknown = await req.json().catch(() => null);
    const parsed = approveTransactionBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "Invalid SEP-8 approval request.");
    }

    const result = await approveTransaction(parsed.data);

    await audit("SEP8_APPROVE", {
      ip,
      target: "sep8",
      meta: { status: result.status },
    });

    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (status === 429) {
      headers["retry-after"] = String((err as { retryAfter?: number }).retryAfter ?? 60);
    }
    return NextResponse.json(body, { status, headers });
  }
}
