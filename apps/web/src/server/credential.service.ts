import "server-only";
import { db } from "@/lib/db";
import { publishRoot } from "@/lib/stellar";
import { putObject } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import { buildLeaf, type Attributes, type FieldHex } from "@zelyo/zk-shared";
import { insertLeaf } from "./merkle.service";
import { publishMintLog } from "./mintlog";

export type MintInput = {
  holder: { username?: string; idCommitment?: FieldHex };
  attributes: Attributes;
};

export type CredentialSummary = {
  id: string;
  leafIndex: number;
  merkleRootHex: FieldHex;
  vcFileKey: string;
};

type MintCtx = { actorUserId: string; ip?: string; jobId: string };

// Resolve the PUBLIC id_commitment for the target holder (server never sees `s`).
async function resolveCommitment(
  holder: MintInput["holder"],
): Promise<{ idCommitment: FieldHex; holderKeyId: string }> {
  if (holder.idCommitment) {
    const row = await db.holderKey.findUnique({ where: { idCommitment: holder.idCommitment } });
    if (!row) throw new AppError("UNKNOWN_HOLDER", 404, "No holder is registered with that id_commitment");
    return { idCommitment: holder.idCommitment, holderKeyId: row.id };
  }
  if (holder.username) {
    const row = await db.holderKey.findFirst({ where: { user: { username: holder.username } } });
    if (!row) throw new AppError("NO_COMMITMENT", 404, "That learner has no published id_commitment yet");
    return { idCommitment: row.idCommitment as FieldHex, holderKeyId: row.id };
  }
  throw new AppError("BAD_HOLDER", 400, "Provide a holder username or an id_commitment");
}

export async function mintCredential(input: MintInput, ctx: MintCtx): Promise<CredentialSummary> {
  const { jobId } = ctx;
  await publishMintLog(jobId, { event: "RESOLVE_HOLDER", status: "PENDING" });
  const { idCommitment, holderKeyId } = await resolveCommitment(input.holder);
  await publishMintLog(jobId, { event: "RESOLVE_HOLDER", status: "OK", detail: holderKeyId });

  // Build leaf = Poseidon(id_commitment, Poseidon(attributes)) via zk-shared (parity-tested).
  await publishMintLog(jobId, { event: "BUILD_LEAF", status: "PENDING" });
  const leafHex = buildLeaf(idCommitment, input.attributes);
  await publishMintLog(jobId, { event: "BUILD_LEAF", status: "OK", detail: leafHex.slice(0, 12) + "…" });

  // Insert into the depth-20 tree, persist Leaf + recompute rootHex.
  await publishMintLog(jobId, { event: "INSERT_LEAF", status: "PENDING" });
  const { index: leafIndex, rootHex } = await insertLeaf(leafHex);
  await publishMintLog(jobId, { event: "INSERT_LEAF", status: "OK", detail: `index ${leafIndex}` });

  // Publish the new root on-chain (ISSUER_SECRET, server-only). Record RootHistory.
  await publishMintLog(jobId, { event: "PUBLISH_ROOT", status: "PENDING" });
  const { txHash } = await publishRoot(rootHex);
  await db.rootHistory.create({ data: { rootHex, txHash, valid: true } });
  await publishMintLog(jobId, { event: "PUBLISH_ROOT", status: "OK", detail: `tx ${txHash.slice(0, 8)}…` });

  // Persist Credential + leaf link; write VC JSON to private storage.
  const issuer = await db.issuer.findFirstOrThrow();
  const tree = await db.merkleTree.findFirstOrThrow();
  const leafRow = await db.leaf.findUniqueOrThrow({
    where: { treeId_index: { treeId: tree.id, index: leafIndex } },
  });
  const credential = await db.credential.create({
    data: {
      issuerId: issuer.id,
      holderKeyId,
      attributes: input.attributes as unknown as object,
      leafId: leafRow.id,
      leafIndex,
      merkleRootHex: rootHex,
      vcFileKey: "pending",
    },
    select: { id: true },
  });
  const vcFileKey = `vc/${credential.id}.json`;

  await publishMintLog(jobId, { event: "WRITE_VC", status: "PENDING" });
  const vc = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    type: ["VerifiableCredential", "ZelyoCredential"],
    id: `urn:zelyo:credential:${credential.id}`,
    issuer: { id: `urn:zelyo:issuer:${issuer.id}`, name: issuer.name },
    issuanceDate: new Date().toISOString(),
    credentialSubject: { ...input.attributes },
    proof: { type: "ZelyoMerkleLeaf", leafHex, leafIndex, merkleRootHex: rootHex },
  };
  await putObject(vcFileKey, JSON.stringify(vc), "application/json");
  await db.credential.update({ where: { id: credential.id }, data: { vcFileKey } });
  await publishMintLog(jobId, { event: "WRITE_VC", status: "OK", detail: vcFileKey });

  // Audit — actor + ip + credential id only; NEVER attribute values.
  await db.auditLog.create({
    data: {
      actorUserId: ctx.actorUserId,
      action: "MINT_CREDENTIAL",
      target: credential.id,
      ip: ctx.ip ?? null,
      meta: { leafIndex, rootHex, txHash },
    },
  });
  logger.info({ action: "mint", credentialId: credential.id, leafIndex, txHash }, "credential minted");
  await publishMintLog(jobId, { event: "SEALED", status: "OK", detail: credential.id });

  return { id: credential.id, leafIndex, merkleRootHex: rootHex, vcFileKey };
}
