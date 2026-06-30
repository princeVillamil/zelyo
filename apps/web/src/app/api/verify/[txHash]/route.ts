import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ txHash: string }> },
): Promise<Response> {
  try {
    const { txHash } = await params;
    const row = await db.verification.findFirst({
      where: { txHash },
      orderBy: { createdAt: "desc" },
    });
    if (!row) throw new AppError("NOT_FOUND", 404, "No verification for that transaction.");
    return NextResponse.json({
      result: row.result,
      nullifierHex: row.nullifierHex,
      disclosed: row.disclosed,
      boundAddress: row.boundAddress,
      boundStellarAddress: row.boundStellarAddress,
      txHash: row.txHash,
      explorerUrl: row.explorerUrl,
    });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (status === 429) {
      headers["retry-after"] = String((err as { retryAfter?: number }).retryAfter ?? 60);
    }
    return NextResponse.json(body, { status, headers });
  }
}
