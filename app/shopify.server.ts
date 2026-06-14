import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { notifyAppInstalled } from "./lib/app-lifecycle-email.server";

function normalizeAppUrl(value?: string) {
  const rawUrl = value?.trim();
  if (!rawUrl) return "";

  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    return `https://${rawUrl}`.replace(/\/+$/, "");
  }

  const url = new URL(rawUrl);
  if (url.protocol === "http:" && !isLocalHost(url.hostname)) {
    url.protocol = "https:";
  }

  return url.toString().replace(/\/+$/, "");
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
const appUrl =
  appEnv === "production"
    ? normalizeAppUrl(
        process.env.PROD_SHOPIFY_APP_URL ||
          process.env.SHOPIFY_APP_URL ||
          process.env.APP_URL,
      )
    : normalizeAppUrl(
        process.env.HOST ||
          process.env.DEV_SHOPIFY_APP_URL ||
          process.env.SHOPIFY_APP_URL ||
          process.env.APP_URL,
      );

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.April26,
  scopes: process.env.SCOPES?.split(","),
  appUrl,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ admin, session }) => {
      await notifyAppInstalled({ admin, session });
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.April26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
