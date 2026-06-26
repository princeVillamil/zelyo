import "server-only";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isCredentialOrphaned } from "@/lib/orphan";
import { AppError, toErrorResponse } from "@/lib/errors";
import { NextResponse } from "next/server";

// Strict so the server rejects any payload containing the secret `s` (or anything extra).
// `force` opts in to a change that would orphan currently-provable credentials.
const bodySchema = z
  .object({
    idCommitment: z.string().regex(/^0x[0-9a-f]{64}$/),
    force: z.boolean().optional(),
  })
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
    const next = parsed.data.idCommitment;

    const existing = await db.holderKey.findUnique({
      where: { userId: session.user.id },
      select: { id: true, idCommitment: true },
    });
    const commitmentChanged = !!existing && existing.idCommitment !== next;

    // Guard: block only when the change strictly REDUCES the set of provable
    // credentials — i.e. it would orphan credentials that are provable today.
    // This still blocks "Generate Identity" (new key orphans matching leaves) but
    // permits restoring the original key (it re-homes leaves that are orphaned now).
    let orphanedByChange = 0;
    if (commitmentChanged) {
      const creds = await db.credential.findMany({
        where: { holderKeyId: existing!.id, status: "ACTIVE" },
        select: { status: true, attributes: true, leaf: { select: { leafHex: true } } },
      });
      orphanedByChange = creds.filter((c) => {
        const provableNow = !isCredentialOrphaned({
          currentCommitment: existing!.idCommitment,
          status: c.status,
          attributes: c.attributes,
          leafHex: c.leaf.leafHex,
        });
        const provableAfter = !isCredentialOrphaned({
          currentCommitment: next,
          status: c.status,
          attributes: c.attributes,
          leafHex: c.leaf.leafHex,
        });
        return provableNow && !provableAfter;
      }).length;

      if (orphanedByChange > 0 && !parsed.data.force) {
        throw new AppError(
          "COMMITMENT_HAS_CREDENTIALS",
          409,
          `Changing your identity key will orphan ${orphanedByChange} provable credential(s); they would no longer be provable. Restore your original key from a backup instead, or confirm to replace it.`,
        );
      }
    }

    const row = await db.holderKey.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, idCommitment: next },
      update: { idCommitment: next },
    });

    if (commitmentChanged) {
      // Public commitments only — never log the secret.
      await audit("holder.commitment.replace", {
        actorUserId: session.user.id,
        meta: {
          previousCommitment: existing!.idCommitment,
          newCommitment: row.idCommitment,
          orphanedCredentials: orphanedByChange,
        },
      });
    }

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
