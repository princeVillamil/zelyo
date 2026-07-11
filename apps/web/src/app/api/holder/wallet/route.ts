import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";
import { AppError, toErrorResponse } from "@/lib/errors";
import { audit } from "@/lib/audit";

const stellarAddress = z
  .string()
  .regex(/^[GC][A-Z2-7]{55}$/, "Invalid Stellar or Soroban contract address");

const putWalletBodySchema = z.object({
  type: z.enum(["STELLAR_ACCOUNT", "PASSKEY_SMART_WALLET"]),
  address: stellarAddress,
  credentialId: z.string().optional(),
  makeDefault: z.boolean().default(false),
});

const deleteWalletParamsSchema = z.object({
  id: z.string().min(1),
});

/**
 * GET /api/holder/wallet
 *
 * List the linked wallets for the currently logged-in holder.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.holderWallet, ip);

    const session = await auth();
    if (!session || session.user.role !== "HOLDER") {
      throw new AppError("UNAUTHORIZED", 401, "Authentication required.");
    }

    const wallets = await db.holderWallet.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ wallets });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (status === 429) {
      headers["retry-after"] = String((err as { retryAfter?: number }).retryAfter ?? 60);
    }
    return NextResponse.json(body, { status, headers });
  }
}

/**
 * PUT /api/holder/wallet
 *
 * Link a new wallet (SEP-10 account or passkey smart wallet) to the holder.
 */
export async function PUT(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.holderWallet, ip);

    const session = await auth();
    if (!session || session.user.role !== "HOLDER") {
      throw new AppError("UNAUTHORIZED", 401, "Authentication required.");
    }

    const body = (await req.json()) as Record<string, unknown>;
    const parsed = putWalletBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "Invalid wallet payload.");
    }

    const { type, address, credentialId, makeDefault } = parsed.data;

    const wallet = await db.holderWallet.upsert({
      where: { userId_address: { userId: session.user.id, address } },
      create: {
        userId: session.user.id,
        type,
        address,
        credentialId: credentialId ?? null,
        isDefault: makeDefault,
      },
      update: {
        type,
        credentialId: credentialId ?? null,
        isDefault: makeDefault,
      },
    });

    if (makeDefault) {
      await db.holderWallet.updateMany({
        where: { userId: session.user.id, id: { not: wallet.id } },
        data: { isDefault: false },
      });
    }

    await audit("HOLDER_WALLET_PUT", {
      actorUserId: session.user.id,
      ip,
      target: address,
      meta: { type, makeDefault },
    });

    return NextResponse.json({ wallet });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (status === 429) {
      headers["retry-after"] = String((err as { retryAfter?: number }).retryAfter ?? 60);
    }
    return NextResponse.json(body, { status, headers });
  }
}

/**
 * DELETE /api/holder/wallet?id=...
 *
 * Remove a linked wallet from the holder.
 */
export async function DELETE(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.holderWallet, ip);

    const session = await auth();
    if (!session || session.user.role !== "HOLDER") {
      throw new AppError("UNAUTHORIZED", 401, "Authentication required.");
    }

    const url = new URL(req.url);
    const parsed = deleteWalletParamsSchema.safeParse({
      id: url.searchParams.get("id") ?? undefined,
    });
    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "Wallet id is required.");
    }

    const existing = await db.holderWallet.findFirst({
      where: { id: parsed.data.id, userId: session.user.id },
    });
    if (!existing) {
      throw new AppError("NOT_FOUND", 404, "Wallet not found.");
    }

    await db.holderWallet.delete({ where: { id: parsed.data.id } });

    await audit("HOLDER_WALLET_DELETE", {
      actorUserId: session.user.id,
      ip,
      target: existing.address,
      meta: { type: existing.type },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (status === 429) {
      headers["retry-after"] = String((err as { retryAfter?: number }).retryAfter ?? 60);
    }
    return NextResponse.json(body, { status, headers });
  }
}
