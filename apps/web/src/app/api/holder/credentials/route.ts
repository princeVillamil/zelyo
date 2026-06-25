import "server-only";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getMerkleProof } from "@/server/merkle.service";
import { AppError, toErrorResponse } from "@/lib/errors";
import { NextResponse } from "next/server";

export async function GET(_req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session || session.user.role !== "HOLDER") {
      throw new AppError("UNAUTHORIZED", 401, "Sign in as a holder.");
    }
    const holderKey = await db.holderKey.findUnique({ where: { userId: session.user.id } });
    if (!holderKey) return NextResponse.json({ credentials: [] });

    const rows = await db.credential.findMany({
      where: { holderKeyId: holderKey.id },
      orderBy: { createdAt: "desc" },
    });

    const credentials = await Promise.all(
      rows.map(async (c) => {
        const proof = await getMerkleProof(c.leafIndex);
        return {
          id: c.id,
          status: c.status,
          attributes: c.attributes,
          leafIndex: c.leafIndex,
          merkleRootHex: c.merkleRootHex,
          root: proof.rootHex,
          merklePath: { siblings: proof.siblings, pathIndices: proof.pathIndices },
        };
      }),
    );
    return NextResponse.json({ credentials });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers =
      status === 429
        ? { "Retry-After": String((err as { retryAfter?: number }).retryAfter ?? 60) }
        : undefined;
    return NextResponse.json(body, { status, ...(headers ? { headers } : {}) });
  }
}
