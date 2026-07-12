import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requestQuote, postQuoteBodySchema } from "@/server/sep38.service";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";
import { AppError, toErrorResponse } from "@/lib/errors";
import { audit } from "@/lib/audit";

/**
 * POST /api/sep38/quote — request a firm (expiring) SEP-38 quote.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md
 *
 * ADMIN-gated: issuers request quotes for reward delivery. The service authenticates
 * to the anchor with SEP38_API_KEY and persists the quote to RampQuote.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.sep38, ip);

    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      throw new AppError("UNAUTHORIZED", 401, "Admin authentication required.");
    }

    const body = (await req.json()) as Record<string, unknown>;
    const parsed = postQuoteBodySchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "Invalid SEP-38 quote request.");
    }

    const result = await requestQuote(parsed.data);

    await audit("SEP38_POST_QUOTE", {
      actorUserId: session.user.id,
      ip,
      target: `${parsed.data.sell_asset}->${parsed.data.buy_asset}`,
      meta: { anchorQuoteId: result.id, local_id: result.local_id },
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
