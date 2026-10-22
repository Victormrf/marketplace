const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const {
  TARGET,
  DEFAULT_URL,
  assertTarget,
  assertConfirmation,
  assertProfileApproval,
  command,
  inspectContainer,
  hostStorage,
  measureStorage,
  assertBudget,
} = require("./environment");
const database = require("./database");
const { config, GENERATOR_VERSION, buildPlan } = require("./planner");
const { TABLES, rows, auditPlan } = require("./records");
const { validate } = require("./validate");

const BACKEND = path.resolve(__dirname, "../..");
const COMPOSE = path.resolve(BACKEND, "..", "docker-compose.scale.yml");
const BATCH_SIZE = 500;

function* batches(iterator, size = BATCH_SIZE) {
  let batch = [];

  for (const row of iterator) {
    batch.push(row);

    if (batch.length === size) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length) yield batch;
}

function parseArguments(values) {
  const options = { command: values[0], profile: "small" };
  const allowed = {
    "--profile": "profile",
    "--confirm": "confirm",
    "--approve-profile": "approval",
  };

  for (let index = 1; index < values.length; index += 2) {
    const key = allowed[values[index]];

    if (!key || !values[index + 1])
      throw new Error("Unknown or incomplete scale argument");
    options[key] = values[index + 1];
  }

  if (
    ![
      "prepare",
      "dry-run",
      "load",
      "purge",
      "status",
      "report",
      "verify",
    ].includes(options.command)
  ) {
    throw new Error(
      "Use prepare, dry-run, load, purge, status, report or verify",
    );
  }

  return options;
}

async function prepare() {
  const url = assertTarget(process.env.SCALE_DATABASE_URL || DEFAULT_URL);
  const volumes = command("docker", [
    "volume",
    "ls",
    "--filter",
    `name=^${TARGET.volume}$`,
    "--format",
    "{{.Name}}",
  ]);

  if (volumes) {
    const [volume] = JSON.parse(
      command("docker", ["volume", "inspect", TARGET.volume]),
    );
    if (volume.Labels?.["com.marketplace.environment"] !== "scale-v1") {
      throw new Error("Existing named volume is not authorized for scale");
    }
  }

  const existing = command("docker", [
    "ps",
    "-a",
    "--filter",
    `name=^/${TARGET.container}$`,
    "--format",
    "{{.Names}}",
  ]);

  if (existing) {
    const [container] = JSON.parse(
      command("docker", ["inspect", TARGET.container]),
    );
    if (container.Config.Labels["com.marketplace.environment"] !== "scale-v1") {
      throw new Error("Existing container is not authorized for scale");
    }
  }

  const host = hostStorage();
  if (host.windowsFreeBytes < 3 * 1024 ** 3)
    throw new Error("Insufficient Windows space to provision scale");
  console.log(
    command("docker", [
      "compose",
      "-f",
      COMPOSE,
      "up",
      "-d",
      "--wait",
      "postgres-scale",
    ]),
  );
  inspectContainer();
  const db = database.client();

  try {
    await database.identify(db);
    const migrate = spawnSync(
      process.execPath,
      [
        path.join(BACKEND, "node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
        "--schema",
        path.join(BACKEND, "prisma/schema.prisma"),
      ],
      {
        cwd: BACKEND,
        env: { ...process.env, DATABASE_URL: url },
        stdio: "inherit",
        windowsHide: true,
        timeout: 60000,
      },
    );

    if (migrate.error || migrate.status !== 0)
      throw new Error("Scale-only migrations failed");
    console.log(
      JSON.stringify(
        { prepared: true, target: TARGET, storage: await measureStorage(db) },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}

async function load(db, options) {
  assertConfirmation(options.confirm);
  const control = await database.identify(db);
  assertProfileApproval(
    options.profile,
    options.approval,
    control.small_measured,
  );
  database.assertReady(control, await database.countRows(db));
  const started = Date.now();
  const plan = buildPlan(
    options.profile,
    options.approval,
    control.small_measured,
  );
  const planned = auditPlan(plan);
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);

  try {
    return await database.exclusive(
      db,
      async () => {
        await database.identify(db);
        const before = await measureStorage(db);
        assertBudget(
          before,
          config.executionPolicy,
          plan.profile.limits,
          0,
          BATCH_SIZE,
          Date.now() - started,
        );
        let report = {
          runId: randomUUID(),
          profile: plan.name,
          seed: config.randomSeed,
          configurationVersion: config.version,
          generatorVersion: GENERATOR_VERSION,
          startedAt: new Date(started).toISOString(),
          result: "loading",
          target: TARGET,
          planned: planned.counts,
          plannedTotal: planned.total,
          expectedDatasetSha256: planned.datasetSha256,
          inserted: Object.fromEntries(TABLES.map(([, table]) => [table, 0])),
          insertedTotal: 0,
          storageBefore: before,
          storagePeakBytes: before.postgresDirectoryBytes,
          minimumWindowsFreeBytes: before.windowsFreeBytes,
        };
        await database.consume(db, report);

        try {
          for (const [model, table] of TABLES) {
            for (const batch of batches(rows(model, plan))) {
              if (cancelled) throw new Error("Load interrupted by signal");
              const current = await measureStorage(db);
              assertBudget(
                current,
                config.executionPolicy,
                plan.profile.limits,
                report.insertedTotal,
                batch.length,
                Date.now() - started,
              );
              const next = {
                ...report,
                inserted: {
                  ...report.inserted,
                  [table]: report.inserted[table] + batch.length,
                },
                insertedTotal: report.insertedTotal + batch.length,
                durationMs: Date.now() - started,
                storagePeakBytes: Math.max(
                  report.storagePeakBytes,
                  current.postgresDirectoryBytes,
                ),
                minimumWindowsFreeBytes: Math.min(
                  report.minimumWindowsFreeBytes,
                  current.windowsFreeBytes,
                ),
              };

              await db.$transaction(
                async (tx) => {
                  await tx[model].createMany({ data: batch });
                  await database.saveReport(tx, next);
                },
                { timeout: 20000 },
              );
              report = next;
            }
            console.log(`${table}: ${report.inserted[table]} committed`);
          }

          const verified = await validate(
            db,
            planned.counts,
            config.baseDateUtc,
          );
          const after = await measureStorage(db);
          assertBudget(
            after,
            config.executionPolicy,
            plan.profile.limits,
            report.insertedTotal,
            0,
            Date.now() - started,
          );
          report = {
            ...report,
            result: "completed",
            durationMs: Date.now() - started,
            finishedAt: new Date().toISOString(),
            storageAfter: after,
            invariants: verified.checked,
          };
          await database.saveReport(db, report, "completed");
          return report;
        } catch (error) {
          // One state update, no insertion retry or automatic purge. A dead connection
          // leaves durable loading + committed batch counts, detected as orphaned by status.
          try {
            const persisted = await database.identify(db);
            await database.saveReport(
              db,
              {
                ...persisted.report,
                result: "interrupted",
                durationMs: Date.now() - started,
                finishedAt: new Date().toISOString(),
                failure: String(error.message)
                  .replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]")
                  .slice(0, 1000),
              },
              "interrupted",
            );
          } catch {
            console.error(
              "Operational result unknown; read-only status required. Do not rerun load.",
            );
          }
          throw error;
        }
      },
      plan.profile.limits.maxDurationMs + 60000,
    );
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  assertTarget(process.env.SCALE_DATABASE_URL || DEFAULT_URL);

  if (options.command === "prepare") return prepare();
  inspectContainer();
  const db = database.client();

  try {
    const control = await database.identify(db);
    let result;

    if (options.command === "purge") {
      assertConfirmation(options.confirm);
      console.log(
        JSON.stringify({ operation: "purge", confirmedTarget: TARGET }),
      );
      await measureStorage(db);
      result = await database.purge(db);
    } else if (options.command === "load") {
      result = await load(db, options);
    } else if (options.command === "dry-run") {
      assertProfileApproval(
        options.profile,
        options.approval,
        control.small_measured,
      );
      const plan = buildPlan(
        options.profile,
        options.approval,
        control.small_measured,
      );
      const storage = await measureStorage(db);
      assertBudget(
        storage,
        config.executionPolicy,
        plan.profile.limits,
        0,
        BATCH_SIZE,
        0,
      );
      // Also exercises every invariant SQL query before authorization is consumed.
      const checked = await validate(db, null, config.baseDateUtc);
      result = {
        command: "dry-run",
        target: TARGET,
        profile: plan.name,
        limits: plan.profile.limits,
        planned: auditPlan(plan),
        storage,
        state: control.state,
        existingTotal: checked.total,
        authorizationConsumed: false,
      };
    } else if (options.command === "verify") {
      if (!control.report.planned)
        throw new Error("No persisted load plan to verify");
      result = await validate(db, control.report.planned, config.baseDateUtc);
    } else {
      result = {
        ...(await database.status(db)),
        storageNow: await measureStorage(db),
      };
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]"),
    );
    process.exitCode = 1;
  });
}

module.exports = { BATCH_SIZE, batches, parseArguments, load };
