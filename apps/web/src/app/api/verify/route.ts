import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";
import { verifyAndRegister } from "@/server/verification.service";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";
import { AppError, toErrorResponse } from "@/lib/errors";
import { audit } from "@/lib/audit";

const fieldHex = z.string().regex(/^0x[0-9a-f]{64}$/);

const stellarAddress = z.string().regex(/^G[A-Z2-7]{55}$/);

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
        disclosed: z.object({
          value: fieldHex,
          raw: z.record(z.string(), z.string()),
        }),
      })
      .strict(),
    boundStellarAddress: stellarAddress,
    credentialId: z.string().optional(),
  })
  .strict();

export async function POST(req: Request): Promise<Response> {
  try {
    const ip = clientIp(req.headers);
    await consumeOrThrow(limiters.verify, ip);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "Invalid proof payload.");
    }

    const result = await verifyAndRegister({
      proof: Uint8Array.from(parsed.data.proof),
      publicInputs: parsed.data.publicInputs as never,
      boundStellarAddress: parsed.data.boundStellarAddress,
      ...(parsed.data.credentialId !== undefined && { credentialId: parsed.data.credentialId }),
    });

    // Audit the verify attempt — actor is anonymous (public route), ip + non-PII
    // references only (nullifier hash, result code, txHash). NEVER attributes / `s`.
    await audit("VERIFY", {
      ip,
      target: parsed.data.publicInputs.nullifier,
      meta: { result: result.result, txHash: result.txHash },
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
