import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { FieldHex } from "@zelyo/zk-shared";
import { AppError, toErrorResponse } from "../../../../../../lib/errors";
import { rateLimit, RateLimitError } from "../../../../../../lib/ratelimit";
import { audit } from "../../../../../../lib/audit";
import { claimGate } from "../../../../../../server/jobgate.service";

const claimBodySchema = z.object({
  nullifierHex: z.string().regex(/^0x[0-9a-f]{1,64}$/),
  boundAddress: z.string().regex(/^G[A-Z2-7]{55}$/),
  txHash: z.string().min(1).max(128),
});

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  try {
    const { slug } = await ctx.params;
    const ip = clientIp(req);

    // Mutating public route — 10/min per IP (returns 429 + Retry-After).
    const rl = await rateLimit(`jobclaim:${ip}`, 10, 60);
    if (!rl.ok) throw new RateLimitError(rl.retryAfter);

    const json: unknown = await req.json().catch(() => null);
    const parsed = claimBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("INVALID_BODY", 400, "Invalid claim payload.");
    }
    const { nullifierHex, boundAddress, txHash } = parsed.data;

    try {
      const result = await claimGate(slug, nullifierHex as FieldHex, boundAddress, txHash);
      await audit("jobgate.claim", {
        target: slug,
        ip,
        meta: { nullifierHex, txHash, rewardType: result.rewardType, ok: true },
      });
      return NextResponse.json(result);
    } catch (err) {
      const code = err instanceof AppError ? err.code : "ERROR";
      await audit("jobgate.claim", { target: slug, ip, meta: { nullifierHex, txHash, ok: false, code } });
      throw err;
    }
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (status === 429) {
      headers["retry-after"] = String((err as { retryAfter?: number }).retryAfter ?? 60);
    }
    return NextResponse.json(body, { status, headers });
  }
}
