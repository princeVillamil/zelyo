import "server-only";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { signedVcUrl } from "@/lib/storage";
import { AppError, toErrorResponse } from "@/lib/errors";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session || session.user.role !== "HOLDER") {
      throw new AppError("UNAUTHORIZED", 401, "Sign in as a holder.");
    }
    const { id } = await params;
    const holderKey = await db.holderKey.findUnique({ where: { userId: session.user.id } });
    if (!holderKey) throw new AppError("NOT_FOUND", 404, "Credential not found.");

    const cred = await db.credential.findFirst({ where: { id, holderKeyId: holderKey.id } });
    if (!cred) throw new AppError("NOT_FOUND", 404, "Credential not found.");

    const url = await signedVcUrl(cred.vcFileKey);
    return NextResponse.json({ url });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers =
      status === 429
        ? { "Retry-After": String((err as { retryAfter?: number }).retryAfter ?? 60) }
        : undefined;
    return NextResponse.json(body, { status, ...(headers ? { headers } : {}) });
  }
}
