-- AlterTable
ALTER TABLE "GiftMessage"
ADD COLUMN "messageCardProductTitle" TEXT,
ADD COLUMN "messageCardVariantTitle" TEXT,
ADD COLUMN "messageCardVariantId" TEXT,
ADD COLUMN "messageCardSku" TEXT,
ADD COLUMN "messageCardQuantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "messageCardReference" TEXT;
