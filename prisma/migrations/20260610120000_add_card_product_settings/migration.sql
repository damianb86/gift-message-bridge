-- CreateTable
CREATE TABLE "CardProductSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "productsJson" TEXT NOT NULL DEFAULT 'null',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardProductSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardProductSettings_shop_key" ON "CardProductSettings"("shop");
