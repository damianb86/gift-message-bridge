-- CreateTable
CREATE TABLE "AppInstallation" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopGid" TEXT,
    "shopName" TEXT,
    "shopEmail" TEXT,
    "shopContactEmail" TEXT,
    "myshopifyDomain" TEXT,
    "primaryDomain" TEXT,
    "planDisplayName" TEXT,
    "currencyCode" TEXT,
    "ianaTimezone" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "installEmailSentAt" TIMESTAMP(3),
    "uninstallEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppInstallation_shop_key" ON "AppInstallation"("shop");
