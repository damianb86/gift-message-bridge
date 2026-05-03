ALTER TABLE "GiftMessage" ADD COLUMN "sourceId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "GiftMessage" ADD COLUMN "propertyName" TEXT;

UPDATE "GiftMessage"
SET "sourceId" = 'cart:' || "cartToken"
WHERE "sourceId" = '';

DROP INDEX "GiftMessage_shop_cartToken_key";

CREATE UNIQUE INDEX "GiftMessage_shop_sourceId_key" ON "GiftMessage"("shop", "sourceId");
