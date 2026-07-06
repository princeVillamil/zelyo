import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";
import { submitViaLaunchtube } from "@/lib/launchtube";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";
import { AppError, toErrorResponse } from "@/lib/errors";
import { audit } from "@/lib/audit";

const bodySchema = z.object({
  xdr: z.string().min(1),
});

/**
 * POST /api/launchtube/submit
 *
 * Relay a client-signed Stellar transaction XDR to Launchtube for fee sponsorship.
 * The Launchtube JWT never leaves the server.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.launchtube, ip);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new AppError("INVALID_BODY", 400, "Missing signed transaction XDR.");
    }

    const result = await submitViaLaunchtube(parsed.data.xdr);

    await audit("LAUNCHTUBE_SUBMIT", {
      ip,
      meta: { status: result.status, creditsRemaining: result.creditsRemaining },
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
