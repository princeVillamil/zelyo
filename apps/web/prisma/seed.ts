import { hash } from "@node-rs/argon2";
import { MERKLE_DEPTH, emptyTreeRoot } from "@zelyo/zk-shared";
import { db } from "../src/lib/db";
import { env } from "../src/lib/env";

async function hashPassword(plain: string): Promise<string> {
  // @node-rs/argon2 defaults to Argon2id (its `Algorithm` enum is an ambient
  // const enum, which verbatimModuleSyntax forbids importing).
  return hash(plain, {
    memoryCost: 19456, // ~19 MiB (OWASP-recommended floor)
    timeCost: 2,
    parallelism: 1,
  });
}

export async function seed(): Promise<void> {
  // Admin user (idempotent on unique username).
  await db.user.upsert({
    where: { username: env.ADMIN_USERNAME },
    update: {},
    create: {
      username: env.ADMIN_USERNAME,
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      role: "ADMIN",
    },
  });

  // One issuer. No natural unique key in the model, so guard with findFirst.
  const existingIssuer = await db.issuer.findFirst({ where: { name: env.ISSUER_NAME } });
  if (!existingIssuer) {
    await db.issuer.create({
      data: { name: env.ISSUER_NAME, stellarAccount: env.ISSUER_STELLAR_ACCOUNT },
    });
  }

  // Empty depth-20 Merkle tree with the canonical empty-tree root.
  const existingTree = await db.merkleTree.findFirst();
  if (!existingTree) {
    await db.merkleTree.create({
      data: { depth: MERKLE_DEPTH, rootHex: emptyTreeRoot(), leafCount: 0 },
    });
  }

  // Demo job gate (idempotent on unique slug).
  await db.jobGate.upsert({
    where: { slug: "data-engineering" },
    update: {},
    create: {
      slug: "data-engineering",
      title: "Data Engineering Graduate",
      description:
        "Prove, in zero knowledge, that you hold a credential whose track is Data Engineering — without revealing name or grade.",
      requiredPredicates: [{ attribute: "track", equals: "Data Engineering" }],
      rewardType: "CLAIMABLE_BALANCE",
      rewardConfig: { asset: { code: "XLM", issuer: "", amount: "10" } },
    },
  });
}

// Run when invoked directly (db:seed via tsx). Skipped under test (vitest sets NODE_ENV=test).
if (process.env.NODE_ENV !== "test") {
  seed()
    .then(() => db.$disconnect())
    .catch(async (e) => {
      console.error("Seed failed:", e instanceof Error ? e.message : e);
      await db.$disconnect();
      process.exit(1);
    });
}
