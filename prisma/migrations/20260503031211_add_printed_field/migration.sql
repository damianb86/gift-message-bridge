-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GiftMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "cartToken" TEXT NOT NULL,
    "cartReference" TEXT,
    "sourceId" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "sender" TEXT NOT NULL DEFAULT '',
    "recipient" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL DEFAULT 'order',
    "propertyName" TEXT,
    "productId" TEXT,
    "productTitle" TEXT,
    "productVariantTitle" TEXT,
    "productSku" TEXT,
    "productHandle" TEXT,
    "printed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_GiftMessage" ("cartReference", "cartToken", "createdAt", "id", "message", "mode", "productHandle", "productId", "productSku", "productTitle", "productVariantTitle", "propertyName", "recipient", "sender", "shop", "sourceId", "updatedAt") SELECT "cartReference", "cartToken", "createdAt", "id", "message", "mode", "productHandle", "productId", "productSku", "productTitle", "productVariantTitle", "propertyName", "recipient", "sender", "shop", "sourceId", "updatedAt" FROM "GiftMessage";
DROP TABLE "GiftMessage";
ALTER TABLE "new_GiftMessage" RENAME TO "GiftMessage";
CREATE UNIQUE INDEX "GiftMessage_shop_sourceId_key" ON "GiftMessage"("shop", "sourceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
