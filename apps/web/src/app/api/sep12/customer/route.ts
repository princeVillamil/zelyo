import { z } from "zod";
import { NextResponse } from "next/server";
import {
  getCustomer,
  getCustomerQuerySchema,
  putCustomer,
  putCustomerBodySchema,
} from "@/server/sep12.service";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";
import { AppError, toErrorResponse } from "@/lib/errors";
import { audit } from "@/lib/audit";

/**
 * SEP-12 customer endpoint.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0012.md
 *
 * GET  /api/sep12/customer?id=... or ?account=G...
 * PUT  /api/sep12/customer { account: G..., verification_id: ... }
 *
 * Zelyo does not store KYC PII. The only field we require is a Zelyo
 * verification_id proving the account has passed a ZK credential check.
 */

export async function GET(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.sep12, ip);

    const url = new URL(req.url);
    const parsed = getCustomerQuerySchema.safeParse({
      id: url.searchParams.get("id") ?? undefined,
      account: url.searchParams.get("account") ?? undefined,
      memo: url.searchParams.get("memo") ?? undefined,
      memo_type: url.searchParams.get("memo_type") ?? undefined,
    });

    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "Invalid SEP-12 customer query.");
    }

    const result = await getCustomer(parsed.data);

    await audit("SEP12_GET_CUSTOMER", {
      ip,
      target: parsed.data.account ?? parsed.data.id ?? "unknown",
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

export async function PUT(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.sep12, ip);

    const body = (await req.json()) as Record<string, unknown>;
    const parsed = putCustomerBodySchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "Invalid SEP-12 customer request.");
    }

    const result = await putCustomer(parsed.data);

    await audit("SEP12_PUT_CUSTOMER", {
      ip,
      target: parsed.data.account,
      meta: { status: result.status, verification_id: parsed.data.verification_id },
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
