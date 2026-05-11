import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

function normalizeAppUrl(value?: string) {
  if (!value) return "";
  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;
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
