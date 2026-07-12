-- CreateTable
CREATE TABLE "RampQuote" (
    "id" TEXT NOT NULL,
    "anchorQuoteId" TEXT,
    "sellAsset" TEXT NOT NULL,
    "buyAsset" TEXT NOT NULL,
    "sellAmount" TEXT,
    "buyAmount" TEXT,
    "price" TEXT,
    "totalPrice" TEXT,
    "feeAsset" TEXT,
    "feeAmount" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'FIRM',
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RampQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RampQuote_anchorQuoteId_idx" ON "RampQuote"("anchorQuoteId");

-- CreateIndex
CREATE INDEX "RampQuote_status_idx" ON "RampQuote"("status");
