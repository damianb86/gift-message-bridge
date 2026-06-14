import type {
  AdminApiContext,
  Session,
} from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { sendContactEmail } from "../email.server";

const SHOP_DETAILS_QUERY = `#graphql
query AppLifecycleShopDetails {
  shop {
    id
    name
    myshopifyDomain
    email
    contactEmail
    currencyCode
    ianaTimezone
    primaryDomain {
      host
      url
    }
    plan {
      displayName
      partnerDevelopment
      shopifyPlus
    }
  }
}`;

type ShopDetails = {
  currencyCode?: string | null;
  ianaTimezone?: string | null;
  myshopifyDomain?: string | null;
  planDisplayName?: string | null;
  primaryDomain?: string | null;
  shopContactEmail?: string | null;
  shopEmail?: string | null;
  shopGid?: string | null;
  shopName?: string | null;
};

type WebhookPayload = Record<string, unknown>;

export async function notifyAppInstalled({
  admin,
  session,
}: {
  admin: AdminApiContext;
  session: Session;
}) {
  const shop = clean(session.shop);
  if (!shop) return;

  const existing = await db.appInstallation.findUnique({
    where: { shop },
  });

  if (existing && !existing.uninstalledAt) {
    return;
  }

  const now = new Date();
  const details = await getShopDetails(admin);

  await db.appInstallation.upsert({
    where: { shop },
    create: {
      ...details,
      shop,
      installedAt: now,
    },
    update: {
      ...details,
      installedAt: now,
      uninstalledAt: null,
      uninstallEmailSentAt: null,
    },
  });

  try {
    await sendContactEmail({
      type: "App lifecycle: installed",
      subject: `New install - ${details.shopName || shop}`,
      shop,
      message: buildInstalledMessage({ details, installedAt: now, session }),
    });

    await db.appInstallation.update({
      where: { shop },
      data: { installEmailSentAt: new Date() },
    });
  } catch (error) {
    console.error("[app-lifecycle:installed-email]", error);
  }
}

export async function notifyAppUninstalled({
  payload,
  shop,
  topic,
}: {
  payload?: unknown;
  shop: string;
  topic?: string;
}) {
  const cleanShop = clean(shop);
  if (!cleanShop) return;

  const now = new Date();
  const existing = await db.appInstallation.findUnique({
    where: { shop: cleanShop },
  });
  const payloadRecord = isRecord(payload) ? payload : {};
  const payloadDetails = getShopDetailsFromWebhookPayload(payloadRecord);
  const emailDetails = {
    ...(existing ? pickShopDetails(existing) : {}),
    ...payloadDetails,
  };

  await db.appInstallation.upsert({
    where: { shop: cleanShop },
    create: {
      ...payloadDetails,
      shop: cleanShop,
      installedAt: existing?.installedAt || now,
      uninstalledAt: now,
    },
    update: {
      ...payloadDetails,
      uninstalledAt: now,
    },
  });

  try {
    await sendContactEmail({
      type: "App lifecycle: uninstalled",
      subject: `App uninstalled - ${existing?.shopName || cleanShop}`,
      shop: cleanShop,
      message: buildUninstalledMessage({
        details: emailDetails,
        existing,
        payload: payloadRecord,
        topic,
        uninstalledAt: now,
      }),
    });

    await db.appInstallation.update({
      where: { shop: cleanShop },
      data: { uninstallEmailSentAt: new Date() },
    });
  } catch (error) {
    console.error("[app-lifecycle:uninstalled-email]", error);
  }
}

async function getShopDetails(admin: AdminApiContext): Promise<ShopDetails> {
  try {
    const response = await admin.graphql(SHOP_DETAILS_QUERY);
    const json = (await response.json()) as {
      data?: {
        shop?: {
          contactEmail?: string | null;
          currencyCode?: string | null;
          email?: string | null;
          ianaTimezone?: string | null;
          id?: string | null;
          myshopifyDomain?: string | null;
          name?: string | null;
          plan?: {
            displayName?: string | null;
            partnerDevelopment?: boolean | null;
            shopifyPlus?: boolean | null;
          } | null;
          primaryDomain?: {
            host?: string | null;
            url?: string | null;
          } | null;
        };
      };
      errors?: unknown;
    };

    if (json.errors) {
      console.warn("[app-lifecycle:shop-details-errors]", json.errors);
    }

    const shop = json.data?.shop;
    if (!shop) return {};

    const planLabels = [
      clean(shop.plan?.displayName),
      shop.plan?.partnerDevelopment ? "Partner development" : "",
      shop.plan?.shopifyPlus ? "Shopify Plus" : "",
    ].filter(Boolean);

    return {
      currencyCode: clean(shop.currencyCode),
      ianaTimezone: clean(shop.ianaTimezone),
      myshopifyDomain: clean(shop.myshopifyDomain),
      planDisplayName: planLabels.join(" | "),
      primaryDomain: clean(shop.primaryDomain?.url || shop.primaryDomain?.host),
      shopContactEmail: clean(shop.contactEmail),
      shopEmail: clean(shop.email),
      shopGid: clean(shop.id),
      shopName: clean(shop.name),
    };
  } catch (error) {
    console.error("[app-lifecycle:shop-details]", error);
    return {};
  }
}

function getShopDetailsFromWebhookPayload(
  payload: WebhookPayload,
): ShopDetails {
  return compactShopDetails({
    myshopifyDomain: clean(payload.myshopify_domain || payload.domain),
    planDisplayName: clean(payload.plan_name || payload.plan_display_name),
    primaryDomain: clean(payload.domain || payload.primary_domain),
    shopEmail: clean(payload.email || payload.customer_email),
    shopGid: clean(payload.admin_graphql_api_id),
    shopName: clean(payload.name || payload.shop_name),
  });
}

function buildInstalledMessage({
  details,
  installedAt,
  session,
}: {
  details: ShopDetails;
  installedAt: Date;
  session: Session;
}) {
  return [
    "A store installed or reconnected Gift Pulse.",
    "",
    ...formatShopDetails(details, session.shop),
    `Installed at: ${installedAt.toISOString()}`,
    `Session id: ${session.id}`,
    `Session type: ${session.isOnline ? "online" : "offline"}`,
    `Scopes: ${session.scope || "not provided"}`,
  ].join("\n");
}

function buildUninstalledMessage({
  details,
  existing,
  payload,
  topic,
  uninstalledAt,
}: {
  details: ShopDetails;
  existing: {
    currencyCode?: string | null;
    ianaTimezone?: string | null;
    installedAt?: Date | null;
    myshopifyDomain?: string | null;
    planDisplayName?: string | null;
    primaryDomain?: string | null;
    shop: string;
    shopContactEmail?: string | null;
    shopEmail?: string | null;
    shopGid?: string | null;
    shopName?: string | null;
  } | null;
  payload: WebhookPayload;
  topic?: string;
  uninstalledAt: Date;
}) {
  return [
    "A store uninstalled Gift Pulse.",
    "",
    ...formatShopDetails(details, existing?.shop || ""),
    `Webhook topic: ${topic || "app/uninstalled"}`,
    `Installed at: ${existing?.installedAt?.toISOString() || "unknown"}`,
    `Uninstalled at: ${uninstalledAt.toISOString()}`,
    "",
    "Webhook payload:",
    JSON.stringify(redactPayload(payload), null, 2),
  ].join("\n");
}

function pickShopDetails(details: ShopDetails): ShopDetails {
  return compactShopDetails({
    currencyCode: details.currencyCode,
    ianaTimezone: details.ianaTimezone,
    myshopifyDomain: details.myshopifyDomain,
    planDisplayName: details.planDisplayName,
    primaryDomain: details.primaryDomain,
    shopContactEmail: details.shopContactEmail,
    shopEmail: details.shopEmail,
    shopGid: details.shopGid,
    shopName: details.shopName,
  });
}

function compactShopDetails(details: ShopDetails): ShopDetails {
  const compact: ShopDetails = {};

  (Object.keys(details) as Array<keyof ShopDetails>).forEach((key) => {
    const value = clean(details[key]);
    if (value) {
      compact[key] = value;
    }
  });

  return compact;
}

function formatShopDetails(details: ShopDetails, fallbackShop: string) {
  return [
    `Shop domain: ${fallbackShop || details.myshopifyDomain || "unknown"}`,
    `Shop name: ${details.shopName || "not provided"}`,
    `MyShopify domain: ${details.myshopifyDomain || "not provided"}`,
    `Primary domain: ${details.primaryDomain || "not provided"}`,
    `Shop email: ${details.shopEmail || "not provided"}`,
    `Contact email: ${details.shopContactEmail || "not provided"}`,
    `Plan: ${details.planDisplayName || "not provided"}`,
    `Currency: ${details.currencyCode || "not provided"}`,
    `Timezone: ${details.ianaTimezone || "not provided"}`,
    `Shop GID: ${details.shopGid || "not provided"}`,
  ];
}

function redactPayload(payload: WebhookPayload) {
  const redacted: WebhookPayload = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (/token|secret|password|credential/i.test(key)) {
      redacted[key] = "[redacted]";
      return;
    }

    redacted[key] = value;
  });

  return redacted;
}

function isRecord(value: unknown): value is WebhookPayload {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clean(value: unknown): string {
  return String(value || "").trim();
}
