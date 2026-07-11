import { NextResponse } from "next/server";
import { z } from "zod";
import { buildChallenge } from "@/server/sep10.service";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";
import { AppError, toErrorResponse } from "@/lib/errors";
import { audit } from "@/lib/audit";

const challengeQuerySchema = z.object({
  account: z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key"),
});

/**
 * GET /api/sep10/challenge?account=G...
 *
 * Returns a SEP-10 authentication challenge transaction signed by the server.
 * The wallet must sign this transaction and POST it to /api/sep10/token.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.sep10, ip);

    const url = new URL(req.url);
    const parsed = challengeQuerySchema.safeParse({
      account: url.searchParams.get("account") ?? undefined,
    });

    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "Invalid Stellar account.");
    }

    const transaction = await buildChallenge(parsed.data.account);

    await audit("SEP10_GET_CHALLENGE", {
      ip,
      target: parsed.data.account,
    });

    return NextResponse.json({ transaction, network_passphrase: process.env.NETWORK_PASSPHRASE });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (status === 429) {
      headers["retry-after"] = String((err as { retryAfter?: number }).retryAfter ?? 60);
    }
    return NextResponse.json(body, { status, headers });
  }
}
