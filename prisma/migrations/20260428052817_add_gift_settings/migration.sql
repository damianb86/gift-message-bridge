-- CreateTable
CREATE TABLE "GiftSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "applyTo" TEXT NOT NULL DEFAULT 'all',
    "showOnProductPage" BOOLEAN NOT NULL DEFAULT true,
    "showOnCartPage" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT NOT NULL DEFAULT 'Add a gift message',
    "placeholder" TEXT NOT NULL DEFAULT 'Write a birthday, thank you, wedding love, etc.',
    "charLimit" INTEGER NOT NULL DEFAULT 250,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftSettings_shop_key" ON "GiftSettings"("shop");
