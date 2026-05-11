import { spawnSync } from "node:child_process";

const steps = [
  ["npx", ["prisma", "generate"]],
  ["npx", ["prisma", "migrate", "deploy"]],
];

for (const [command, args] of steps) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
