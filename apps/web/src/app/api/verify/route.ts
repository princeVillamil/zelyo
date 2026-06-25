import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";
import { verifyAndRegister } from "@/server/verification.service";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";
import { AppError, toErrorResponse } from "@/lib/errors";

const fieldHex = z.string().regex(/^0x[0-9a-f]{64}$/);

// `.strict()` everywhere so a payload carrying `s` (or any extra key) is rejected — the secret
// must never reach the server.
const bodySchema = z
  .object({
    proof: z.array(z.number().int().min(0).max(255)).max(2_000_000),
    publicInputs: z
      .object({
        root: fieldHex,
        scope: fieldHex,
        boundAddress: fieldHex,
        nullifier: fieldHex,
        disclosed: fieldHex,
      })
      .strict(),
  })
  .strict();

export async function POST(req: Request): Promise<Response> {
  try {
    await consumeOrThrow(limiters.verify, clientIp(req.headers));

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "Invalid proof payload.");
    }

    const result = await verifyAndRegister({
      proof: Uint8Array.from(parsed.data.proof),
      publicInputs: parsed.data.publicInputs as never,
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
