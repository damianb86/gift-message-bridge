ALTER TABLE "GiftMessage" ADD COLUMN "orderId" TEXT;
ALTER TABLE "GiftMessage" ADD COLUMN "orderName" TEXT;

CREATE INDEX "GiftMessage_shop_orderId_idx" ON "GiftMessage"("shop", "orderId");
