-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'HOLDER');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "VerificationResult" AS ENUM ('VERIFIED', 'INVALID_PROOF', 'UNKNOWN_ROOT', 'NULLIFIER_USED', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'HOLDER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issuer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stellarAccount" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issuer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolderKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idCommitment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HolderKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerkleTree" (
    "id" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 20,
    "rootHex" TEXT NOT NULL,
    "leafCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerkleTree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leaf" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "leafHex" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Leaf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RootHistory" (
    "id" TEXT NOT NULL,
    "rootHex" TEXT NOT NULL,
    "txHash" TEXT,
    "valid" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RootHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "holderKeyId" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "leafId" TEXT NOT NULL,
    "leafIndex" INTEGER NOT NULL,
    "merkleRootHex" TEXT NOT NULL,
    "vcFileKey" TEXT NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nullifier" (
    "id" TEXT NOT NULL,
    "nullifierHex" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "boundAddress" TEXT NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nullifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "nullifierHex" TEXT NOT NULL,
    "disclosed" JSONB NOT NULL,
    "boundAddress" TEXT NOT NULL,
    "result" "VerificationResult" NOT NULL,
    "txHash" TEXT,
    "explorerUrl" TEXT,
    "jobGateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobGate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requiredPredicate" JSONB NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateClaim" (
    "id" TEXT NOT NULL,
    "jobGateId" TEXT NOT NULL,
    "nullifierHex" TEXT NOT NULL,
    "boundAddress" TEXT NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "ip" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "HolderKey_userId_key" ON "HolderKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HolderKey_idCommitment_key" ON "HolderKey"("idCommitment");

-- CreateIndex
CREATE UNIQUE INDEX "Leaf_treeId_index_key" ON "Leaf"("treeId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "RootHistory_rootHex_key" ON "RootHistory"("rootHex");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_leafId_key" ON "Credential"("leafId");

-- CreateIndex
CREATE UNIQUE INDEX "Nullifier_nullifierHex_key" ON "Nullifier"("nullifierHex");

-- CreateIndex
CREATE UNIQUE INDEX "JobGate_slug_key" ON "JobGate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GateClaim_jobGateId_nullifierHex_key" ON "GateClaim"("jobGateId", "nullifierHex");

-- AddForeignKey
ALTER TABLE "HolderKey" ADD CONSTRAINT "HolderKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leaf" ADD CONSTRAINT "Leaf_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "MerkleTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "Issuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_holderKeyId_fkey" FOREIGN KEY ("holderKeyId") REFERENCES "HolderKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_leafId_fkey" FOREIGN KEY ("leafId") REFERENCES "Leaf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_jobGateId_fkey" FOREIGN KEY ("jobGateId") REFERENCES "JobGate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateClaim" ADD CONSTRAINT "GateClaim_jobGateId_fkey" FOREIGN KEY ("jobGateId") REFERENCES "JobGate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
