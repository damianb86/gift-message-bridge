import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const env = {
    ...loadEnv(mode, repoRoot, ""),
    ...loadEnv(mode, process.cwd(), ""),
  };
  // The Shopify CLI sets SHOPIFY_APP_URL (or APP_URL) when running
  // `shopify app dev`; production builds fall back to shopify.app.toml.
  const appUrl =
    env.SHOPIFY_APP_URL ??
    env.APP_URL ??
    env.VITE_APP_URL ??
    readApplicationUrl(repoRoot) ??
    "";

  return {
    define: {
      __APP_URL__: JSON.stringify(appUrl),
    },
  };
});

function readApplicationUrl(repoRoot: string): string | undefined {
  try {
    const config = readFileSync(`${repoRoot}/shopify.app.toml`, "utf8");
    return config.match(/^\s*application_url\s*=\s*"([^"]+)"/m)?.[1];
  } catch {
    return undefined;
  }
}
