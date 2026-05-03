-- CreateTable
CREATE TABLE "GiftMessage" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintTemplateSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "selectedTemplateId" TEXT NOT NULL DEFAULT 'classic-note',
    "customHtml" TEXT,
    "customCss" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintTemplateSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "messageReferences" TEXT,
    "printedMarkedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftMessage_shop_sourceId_key" ON "GiftMessage"("shop", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintTemplateSettings_shop_key" ON "PrintTemplateSettings"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_token_key" ON "PrintJob"("token");

-- CreateIndex
CREATE INDEX "ContactRequest_shop_createdAt_idx" ON "ContactRequest"("shop", "createdAt");
