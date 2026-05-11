import { spawn } from "node:child_process";

const env = { ...process.env };
const appEnv = env.APP_ENV || "development";
const port = env.PORT || "3000";

if (appEnv !== "production" && env.HOST) {
  env.SHOPIFY_APP_URL = normalizeAppUrl(env.HOST);
}

console.log(`[shopify-dev-server] Starting React Router on 127.0.0.1:${port}`);

const child = spawn(
  "npx",
  [
    "react-router",
    "dev",
    "--host",
    "127.0.0.1",
    "--port",
    port,
    "--strictPort",
  ],
  {
    stdio: "inherit",
    env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

function normalizeAppUrl(value) {
  const rawUrl = String(value || "").trim();
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

function isLocalHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}
