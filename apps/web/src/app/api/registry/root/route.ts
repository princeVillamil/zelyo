import { db } from "@/lib/db";
import { getCurrentRoot } from "@/server/merkle.service";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(_req: Request): Promise<Response> {
  try {
    const rootHex = await getCurrentRoot();
    const onchain = await db.rootHistory.findFirst({
      where: { rootHex },
      select: { txHash: true, valid: true, publishedAt: true },
    });
    return Response.json({
      rootHex,
      txHash: onchain?.txHash ?? null,
      valid: onchain?.valid ?? false,
      publishedAt: onchain?.publishedAt ?? null,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
