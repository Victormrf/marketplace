const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { command, hostStorage } = require("../scripts/scale/environment");
const { assertMemory } = require("./supervisor");
const TARGET = Object.freeze({
  database: "marketplace_load_test",
  user: "marketplace_load_test",
  port: "5436",
  container: "marketplace-load-test-postgres",
  volume: "marketplace_load_fixture_test_data",
  marker: "marketplace-load-fixture-test-v1",
  label: "load-fixture-test-v1",
});
const URL =
  "postgresql://marketplace_load_test:load_fixture_test_only@127.0.0.1:5436/marketplace_load_test";

function assertTestTarget(raw) {
  const parsed = new globalThis.URL(raw);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
    parsed.port !== TARGET.port ||
    parsed.pathname !== `/${TARGET.database}` ||
    parsed.username !== TARGET.user ||
    parsed.password !== "load_fixture_test_only" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "Refusing fixture operation outside the dedicated marketplace_load_test environment",
    );
  }
  return raw;
}

function client() {
  const raw = assertTestTarget(process.env.LOAD_FIXTURE_DATABASE_URL || URL);
  return new PrismaClient({
    datasources: {
      db: {
        url: `${raw}?connection_limit=4&pool_timeout=5&application_name=load-fixture-controller`,
      },
    },
  });
}

function containerIdentity(requireRunning = true) {
  const [row] = JSON.parse(command("docker", ["inspect", TARGET.container]));
  const binding = row.HostConfig.PortBindings["5432/tcp"];
  const volume = row.Mounts.find(
    (mount) => mount.Destination === "/var/lib/postgresql/data",
  );
  if (
    row.Config.Labels?.["com.marketplace.environment"] !== TARGET.label ||
    (requireRunning && !row.State.Running) ||
    binding?.length !== 1 ||
    binding[0].HostIp !== "127.0.0.1" ||
    binding[0].HostPort !== TARGET.port ||
    volume?.Name !== TARGET.volume
  ) {
    throw new Error("Dedicated fixture container identity mismatch");
  }
}

async function identify(db) {
  assertTestTarget(process.env.LOAD_FIXTURE_DATABASE_URL || URL);
  containerIdentity();
  const [row] =
    await db.$queryRaw`SELECT current_database() AS database,current_user AS username,
    inet_server_port() AS port,shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()),'pg_database') AS marker`;
  if (
    row.database !== TARGET.database ||
    row.username !== TARGET.user ||
    row.port !== 5432 ||
    row.marker !== TARGET.marker
  ) {
    throw new Error("SQL fixture identity mismatch; refusing writes");
  }
}

async function prepareTestEnvironment() {
  const url = assertTestTarget(process.env.LOAD_FIXTURE_DATABASE_URL || URL);
  assertMemory(); // Test writes do not inherit the read-smoke relaxation.
  if (hostStorage().windowsFreeBytes < 3 * 1024 ** 3) {
    throw new Error(
      "Insufficient Windows storage for the dedicated fixture tests",
    );
  }
  const found = command("docker", [
    "ps",
    "-a",
    "--filter",
    `name=^/${TARGET.container}$`,
    "--format",
    "{{.Names}}",
  ]);
  if (found) {
    containerIdentity(false);
  }
  const existing = command("docker", [
    "volume",
    "ls",
    "--filter",
    `name=^${TARGET.volume}$`,
    "--format",
    "{{.Name}}",
  ]);
  if (existing) {
    const [volume] = JSON.parse(
      command("docker", ["volume", "inspect", TARGET.volume]),
    );
    if (volume.Labels?.["com.marketplace.environment"] !== TARGET.label) {
      throw new Error("Fixture volume has another owner");
    }
  }
  const backend = path.resolve(__dirname, "..");
  console.log(
    command("docker", [
      "compose",
      "-f",
      path.join(backend, "../docker-compose.load-test.yml"),
      "up",
      "-d",
      "--wait",
      "postgres-load-test",
    ]),
  );
  const db = client();
  try {
    await identify(db);
    const result = spawnSync(
      process.execPath,
      [
        path.join(backend, "node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
      ],
      {
        cwd: backend,
        env: { ...process.env, DATABASE_URL: url },
        stdio: "inherit",
        windowsHide: true,
        timeout: 60000,
      },
    );
    if (result.status !== 0) {
      throw new Error(
        "Fixture-test baseline deployment failed; no reset or retry",
      );
    }
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  prepareTestEnvironment().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  TARGET,
  URL,
  client,
  identify,
  assertTestTarget,
  prepareTestEnvironment,
};
