CREATE TABLE "PrintTemplateSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "selectedTemplateId" TEXT NOT NULL DEFAULT 'classic-note',
    "customHtml" TEXT,
    "customCss" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "PrintTemplateSettings_shop_key" ON "PrintTemplateSettings"("shop");
