import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import environment from "../e2e/environment.cjs";

const frontendDirectory = path.resolve(
  fileURLToPath(new URL("..", import.meta.url)),
);
const rootDirectory = path.dirname(frontendDirectory);
const { DATABASE_URL, backendDirectory, assertTestDatabase } = environment;
assertTestDatabase(process.env.DATABASE_URL ?? DATABASE_URL);

function run(command, args, cwd = frontendDirectory) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(
  "docker",
  ["compose", "-f", "docker-compose.e2e.yml", "up", "-d", "--wait"],
  rootDirectory,
);
run(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  backendDirectory,
);
run(process.execPath, ["scripts/clean-dist.js"], backendDirectory);
run(process.execPath, ["node_modules/typescript/bin/tsc"], backendDirectory);

const args = process.argv.slice(2);
if (args[0] !== "--prepare-only") {
  run(process.execPath, [
    "node_modules/@playwright/test/cli.js",
    "test",
    ...args,
  ]);
}
