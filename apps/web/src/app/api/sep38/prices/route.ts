import { NextResponse } from "next/server";
import { getPrices, pricesQuerySchema } from "@/server/sep38.service";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";
import { AppError, toErrorResponse } from "@/lib/errors";
import { audit } from "@/lib/audit";

/**
 * GET /api/sep38/prices — indicative SEP-38 prices for an asset pair.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md
 *
 * Public (rate-limited). Responses are cached in Redis for a short TTL by the service.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.sep38, ip);

    const url = new URL(req.url);
    const parsed = pricesQuerySchema.safeParse({
      sell_asset: url.searchParams.get("sell_asset") ?? undefined,
      buy_asset: url.searchParams.get("buy_asset") ?? undefined,
      sell_amount: url.searchParams.get("sell_amount") ?? undefined,
      buy_amount: url.searchParams.get("buy_amount") ?? undefined,
      sell_delivery_method: url.searchParams.get("sell_delivery_method") ?? undefined,
      buy_delivery_method: url.searchParams.get("buy_delivery_method") ?? undefined,
      country_code: url.searchParams.get("country_code") ?? undefined,
    });

    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "Invalid SEP-38 prices query.");
    }

    const result = await getPrices(parsed.data);

    await audit("SEP38_GET_PRICES", {
      ip,
      target: `${parsed.data.sell_asset}->${parsed.data.buy_asset}`,
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
