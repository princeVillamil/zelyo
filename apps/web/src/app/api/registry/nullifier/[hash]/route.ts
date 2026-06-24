import { db } from "@/lib/db";
import { AppError, handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }): Promise<Response> {
  try {
    const { hash } = await params;
    if (!/^0x[0-9a-f]{64}$/.test(hash)) throw new AppError("VALIDATION", 422, "Malformed nullifier hash");
    const row = await db.nullifier.findUnique({
      where: { nullifierHex: hash },
      select: { txHash: true, createdAt: true },
    });
    // Mirror only — the chain is authoritative for uniqueness.
    return Response.json({ used: Boolean(row), txHash: row?.txHash ?? null, mirroredAt: row?.createdAt ?? null });
  } catch (e) {
    return handleApiError(e);
  }
}
