-- CreateTable
CREATE TABLE "GiftMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "cartToken" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL DEFAULT 'order',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftMessage_shop_cartToken_key" ON "GiftMessage"("shop", "cartToken");
