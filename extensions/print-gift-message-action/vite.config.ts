import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // The Shopify CLI sets SHOPIFY_APP_URL (or APP_URL) when running
  // `shopify app dev`; we expose it to the bundle as __APP_URL__.
  const appUrl = env.SHOPIFY_APP_URL ?? env.APP_URL ?? env.VITE_APP_URL ?? "";

  return {
    define: {
      __APP_URL__: JSON.stringify(appUrl),
    },
  };
});
