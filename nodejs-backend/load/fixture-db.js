const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const { command, hostStorage } = require("../scripts/scale/environment");
const { assertMemory } = require("./supervisor");
const scale = require("../scripts/scale/environment");
const scaleDatabase = require("../scripts/scale/database");
const { config } = require("../scripts/scale/planner");
const { validate } = require("../scripts/scale/validate");
const contexts = new WeakMap();
const SCALE_CONFIRMATION = `${scale.TARGET.confirmation}:fixtures`;
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

function client(options = {}) {
  const mode = options.mode || "fixture-test";
  if (!["fixture-test", "scale"].includes(mode)) {
    throw new Error("Unknown fixture environment");
  }
  if (mode === "scale" && options.confirmation !== SCALE_CONFIRMATION) {
    throw new Error("Explicit scale fixtures confirmation required");
  }
  const raw =
    mode === "scale"
      ? scale.assertTarget(process.env.SCALE_DATABASE_URL || scale.DEFAULT_URL)
      : assertTestTarget(process.env.LOAD_FIXTURE_DATABASE_URL || URL);
  const db = new PrismaClient({
    datasources: {
      db: {
        url: `${raw}?connection_limit=4&pool_timeout=5&application_name=load-fixture-controller`,
      },
    },
  });
  contexts.set(db, {
    mode,
    confirmation: options.confirmation,
    reference: options.reference === true,
  });
  return db;
}

function context(db) {
  return contexts.get(db) || { mode: "fixture-test" };
}

function assertWrite(db) {
  if (
    context(db).reference &&
    !require("./plan.json").reducedBaseline.enabled
  ) {
    throw new Error(
      "Reference experiments are suspended pending an environment decision",
    );
  }
  if (
    context(db).mode === "scale" &&
    !require("./plan.json").fixtures.writesEnabled &&
    !context(db).reference
  ) {
    throw new Error(
      "Scale fixture writes are administratively disabled pending explicit authorization",
    );
  }
  if (
    context(db).mode === "scale" &&
    context(db).confirmation !== SCALE_CONFIRMATION
  ) {
    throw new Error("Scale fixture writes require explicit confirmation");
  }
  assertMemory(undefined, policy(db));
}

function policy(db) {
  const plan = require("./plan.json");
  return context(db).reference
    ? {
        ...plan.stopPolicy,
        minimumStartAvailableMemoryBytes:
          plan.reducedBaseline.minimumStartAvailableMemoryBytes,
        minimumAvailableMemoryBytes:
          plan.reducedBaseline.minimumAvailableMemoryBytes,
      }
    : plan.stopPolicy;
}

function assertReference(db, scenario, operations, reference) {
  if (!context(db).reference) {
    return;
  }
  const plan = require("./plan.json");
  if (
    !plan.reducedBaseline.enabled ||
    !reference ||
    operations !== 2 ||
    !plan.reducedBaseline.writeScenarios.includes(scenario)
  ) {
    throw new Error(
      "Only the two authorized reference checkouts are permitted",
    );
  }
}

async function claimReference(db, tx, manifest) {
  if (!context(db).reference || context(db).mode !== "scale") {
    return;
  }
  await tx.$executeRaw`CREATE TABLE IF NOT EXISTS scale_ops.reference_authorizations (
    id text PRIMARY KEY, namespace text NOT NULL UNIQUE, consumed_at timestamptz NOT NULL DEFAULT now()
  )`;
  const id = `${require("./plan.json").reducedBaseline.id}:${manifest.scenario}`;
  const changed =
    await tx.$executeRaw`INSERT INTO scale_ops.reference_authorizations (id,namespace)
    VALUES (${id},${manifest.namespace}) ON CONFLICT (id) DO NOTHING`;
  if (changed !== 1) {
    throw new Error(
      "Reference experiment already consumed; no repeat is allowed",
    );
  }
}

function descriptor(db) {
  const description =
    context(db).mode === "scale"
      ? {
          mode: "scale",
          apiUrl: "http://127.0.0.1:8051",
          container: scale.TARGET.container,
          dataPath: "/var/lib/postgresql/data/pgdata",
          lockKey: 49314301,
        }
      : {
          mode: "fixture-test",
          apiUrl: "http://127.0.0.1:8052",
          container: TARGET.container,
          dataPath: "/var/lib/postgresql/data",
          lockKey: 5521052,
        };
  return { ...description, reference: context(db).reference === true };
}

function apiEnvironment(db) {
  const mode = context(db).mode;
  const raw =
    mode === "scale"
      ? scale.assertTarget(process.env.SCALE_DATABASE_URL || scale.DEFAULT_URL)
      : assertTestTarget(process.env.LOAD_FIXTURE_DATABASE_URL || URL);
  return {
    PORT: mode === "scale" ? "8051" : "8052",
    DATABASE_URL: `${raw}?connection_limit=5&pool_timeout=10&application_name=load-fixture-api`,
  };
}

async function storage(db) {
  await identify(db);
  if (context(db).mode === "scale") {
    return scale.measureStorage(db);
  }
  const [row] =
    await db.$queryRaw`SELECT pg_database_size(current_database())::float8 AS "databaseBytes"`;
  const sizes = command("docker", [
    "exec",
    TARGET.container,
    "sh",
    "-c",
    "du -sk /var/lib/postgresql/data; du -sk /var/lib/postgresql/data/pg_wal",
  ])
    .split(/\r?\n/)
    .map((line) => Number(line.split(/\s+/)[0]) * 1024);
  if (sizes.length !== 2 || sizes.some((size) => !Number.isFinite(size))) {
    throw new Error("Fixture storage measurements unavailable");
  }
  return {
    ...hostStorage(),
    databaseBytes: row.databaseBytes,
    postgresDirectoryBytes: sizes[0],
    walDirectoryBytes: sizes[1],
    writableLayerBytes: 1024 * 1024,
    boundedLogBytes: 10 * 1024 * 1024,
  };
}

async function guardStorage(db) {
  const snapshot = await storage(db);
  scale.assertBudget(
    snapshot,
    config.executionPolicy,
    config.profiles.small.limits,
    0,
    500,
    0,
  );
  return snapshot;
}

async function baselineInvariants(db, transaction = db) {
  const control = await identify(db);
  return context(db).mode === "scale"
    ? validate(transaction, control.report.inserted, config.baseDateUtc)
    : validate(transaction);
}

async function ensureControl(db) {
  assertWrite(db);
  await db.$executeRaw`CREATE TABLE IF NOT EXISTS scale_ops.load_experiments (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    namespace text,
    state text NOT NULL CHECK (state IN ('EMPTY','PREPARING','READY','RUNNING','UNKNOWN','RECOVERED')),
    manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
    baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
    effects jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await db.$executeRaw`INSERT INTO scale_ops.load_experiments (state)
    VALUES ('EMPTY') ON CONFLICT (singleton) DO NOTHING`;
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
  if (context(db).mode === "scale") {
    scale.assertTarget(process.env.SCALE_DATABASE_URL || scale.DEFAULT_URL);
    scale.inspectContainer();
    const control = await scaleDatabase.identify(db);
    if (
      control.state !== "completed" ||
      control.report?.profile !== "small" ||
      control.report.insertedTotal !== config.profiles.small.totalRows
    ) {
      throw new Error("Completed small scale environment required");
    }
    return control;
  }
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
  const reference = process.argv.includes("--reference");
  const plan = require("./plan.json");
  assertMemory(
    undefined,
    reference
      ? {
          ...plan.stopPolicy,
          minimumStartAvailableMemoryBytes:
            plan.reducedBaseline.minimumStartAvailableMemoryBytes,
        }
      : plan.stopPolicy,
  );
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
  descriptor,
  assertWrite,
  guardStorage,
  baselineInvariants,
  currentInvariants: validate,
  ensureControl,
  SCALE_CONFIRMATION,
  apiEnvironment,
  policy,
  assertReference,
  claimReference,
};
