import "server-only";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { NextResponse } from "next/server";

// Strict so the server rejects any payload containing the secret `s` (or anything extra).
const bodySchema = z
  .object({ idCommitment: z.string().regex(/^0x[0-9a-f]{64}$/) })
  .strict();

export async function PUT(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session || session.user.role !== "HOLDER") {
      throw new AppError("UNAUTHORIZED", 401, "Sign in as a holder.");
    }
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "A valid idCommitment is required.");
    }
    const row = await db.holderKey.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, idCommitment: parsed.data.idCommitment },
      update: { idCommitment: parsed.data.idCommitment },
    });
    return NextResponse.json({ idCommitment: row.idCommitment });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers =
      status === 429
        ? { "Retry-After": String((err as { retryAfter?: number }).retryAfter ?? 60) }
        : undefined;
    return NextResponse.json(body, { status, ...(headers ? { headers } : {}) });
  }
}
