/*
  Warnings:

  - You are about to drop the column `requiredPredicate` on the `JobGate` table. All the data in the column will be lost.
  - You are about to alter the column `boundAddress` on the `Verification` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(68)`.
  - Added the required column `requiredPredicates` to the `JobGate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "JobGate" DROP COLUMN "requiredPredicate",
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "requiredPredicates" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "Verification" ADD COLUMN     "boundStellarAddress" VARCHAR(56),
ADD COLUMN     "credentialId" TEXT,
ALTER COLUMN "boundAddress" SET DATA TYPE VARCHAR(68);
