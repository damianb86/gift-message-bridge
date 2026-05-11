import { spawn } from "node:child_process";

const env = { ...process.env };
const appEnv = env.APP_ENV || "development";
const port = env.PORT || "3000";

if (appEnv !== "production" && env.HOST) {
  env.SHOPIFY_APP_URL = env.HOST;
}

console.log(`[shopify-dev-server] Starting React Router on 127.0.0.1:${port}`);

const child = spawn(
  "npx",
  ["react-router", "dev", "--host", "127.0.0.1", "--port", port, "--strictPort"],
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
