-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('STELLAR_ACCOUNT', 'PASSKEY_SMART_WALLET');

-- CreateTable
CREATE TABLE "HolderWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "WalletType" NOT NULL,
    "address" TEXT NOT NULL,
    "credentialId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolderWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HolderWallet_userId_idx" ON "HolderWallet"("userId");

-- CreateIndex
CREATE INDEX "HolderWallet_address_idx" ON "HolderWallet"("address");

-- CreateIndex
CREATE UNIQUE INDEX "HolderWallet_userId_address_key" ON "HolderWallet"("userId", "address");

-- AddForeignKey
ALTER TABLE "HolderWallet" ADD CONSTRAINT "HolderWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
