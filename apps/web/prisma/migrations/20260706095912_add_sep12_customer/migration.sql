-- CreateTable
CREATE TABLE "Sep12Customer" (
    "id" TEXT NOT NULL,
    "stellarAccount" TEXT NOT NULL,
    "memo" TEXT,
    "memoType" TEXT,
    "status" TEXT NOT NULL,
    "verificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sep12Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sep12Customer_stellarAccount_key" ON "Sep12Customer"("stellarAccount");

-- CreateIndex
CREATE INDEX "Sep12Customer_stellarAccount_idx" ON "Sep12Customer"("stellarAccount");
