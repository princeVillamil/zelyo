import { NextResponse } from "next/server";
import { getQuote } from "@/server/sep38.service";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";
import { AppError, toErrorResponse } from "@/lib/errors";
import { audit } from "@/lib/audit";

/**
 * GET /api/sep38/quote/[id] — retrieve a previously-requested firm quote by local id
 * or anchor quote id. Public (rate-limited).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.sep38, ip);

    const { id } = await params;
    if (!id) {
      throw new AppError("INVALID_INPUT", 400, "Quote id is required.");
    }

    const result = await getQuote(id);

    await audit("SEP38_GET_QUOTE", { ip, target: result.local_id });

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
