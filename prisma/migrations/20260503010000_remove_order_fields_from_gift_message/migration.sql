DROP INDEX IF EXISTS "GiftMessage_shop_orderId_idx";

ALTER TABLE "GiftMessage" DROP COLUMN "orderId";
ALTER TABLE "GiftMessage" DROP COLUMN "orderName";
