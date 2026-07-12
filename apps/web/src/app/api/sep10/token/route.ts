import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { verifyChallenge } from "@/server/sep10.service";
import { db } from "@/lib/db";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";
import { AppError, toErrorResponse } from "@/lib/errors";
import { audit } from "@/lib/audit";

const tokenBodySchema = z.object({
  transaction: z.string().min(1, "Signed transaction XDR is required"),
});

/**
 * POST /api/sep10/token
 *
 * Verifies a signed SEP-10 challenge and links the authenticated Stellar account
 * to the currently logged-in holder. Returns a SEP-10 JWT.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.sep10, ip);

    const session = await auth();
    if (!session || session.user.role !== "HOLDER") {
      throw new AppError("UNAUTHORIZED", 401, "Authentication required.");
    }

    const body = (await req.json()) as Record<string, unknown>;
    const parsed = tokenBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "Invalid request body.");
    }

    const { account, token } = await verifyChallenge(parsed.data.transaction);

    // Upsert the verified Stellar account as the default wallet.
    await db.holderWallet.upsert({
      where: { userId_address: { userId: session.user.id, address: account } },
      create: {
        userId: session.user.id,
        type: "STELLAR_ACCOUNT",
        address: account,
        isDefault: true,
      },
      update: {
        type: "STELLAR_ACCOUNT",
        isDefault: true,
      },
    });

    // Ensure no other wallet for this user remains default.
    await db.holderWallet.updateMany({
      where: { userId: session.user.id, address: { not: account } },
      data: { isDefault: false },
    });

    await audit("SEP10_POST_TOKEN", {
      actorUserId: session.user.id,
      ip,
      target: account,
    });

    return NextResponse.json({ token, address: account });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (status === 429) {
      headers["retry-after"] = String((err as { retryAfter?: number }).retryAfter ?? 60);
    }
    return NextResponse.json(body, { status, headers });
  }
}
