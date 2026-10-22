const { PrismaClient, Prisma } = require("@prisma/client");
const { TABLES } = require("./records");
const { assertTarget, DEFAULT_URL, TARGET } = require("./environment");

const LOCK_KEY = 49314301;

function client() {
  const url = assertTarget(process.env.SCALE_DATABASE_URL || DEFAULT_URL);

  return new PrismaClient({
    datasources: { db: { url: `${url}?connection_limit=3&pool_timeout=15` } },
  });
}

async function identify(db) {
  const [identity] = await db.$queryRaw`
    SELECT current_database() AS database, current_user AS username,
      inet_server_port() AS port,
      shobj_description((SELECT oid FROM pg_database WHERE datname = current_database()),
        'pg_database') AS marker
  `;

  if (
    identity.database !== TARGET.database ||
    identity.username !== TARGET.user ||
    identity.port !== 5432 ||
    identity.marker !== TARGET.environment
  ) {
    throw new Error(
      "Connected database identity is not authorized for scale operations",
    );
  }

  const [control] =
    await db.$queryRaw`SELECT * FROM scale_ops.control WHERE singleton = true`;

  if (control?.environment_id !== TARGET.environment) {
    throw new Error("Persistent scale environment marker missing or incorrect");
  }

  return control;
}

async function countRows(db) {
  const queries = TABLES.map(
    ([, table]) => Prisma.sql`
    SELECT ${table} AS name, count(*)::bigint AS amount
    FROM ${Prisma.raw(`public."${table}"`)}
  `,
  );
  const result = await db.$queryRaw(Prisma.join(queries, " UNION ALL "));

  return Object.fromEntries(
    result.map((row) => [row.name, Number(row.amount)]),
  );
}

function assertReady(control, counts) {
  if (control.state !== "ready") {
    throw new Error(
      "Load authorization already consumed; explicit purge required",
    );
  }

  if (Object.values(counts).some((count) => count !== 0)) {
    throw new Error("Business tables must be empty before load");
  }
}

async function exclusive(db, operation, timeout = 60000) {
  return db.$transaction(
    async (lockConnection) => {
      const [lock] = await lockConnection.$queryRaw`
      SELECT pg_try_advisory_xact_lock(${LOCK_KEY}::bigint) AS acquired
    `;

      if (!lock.acquired) throw new Error("Another load or purge is running");
      return operation();
    },
    { timeout, maxWait: 5000 },
  );
}

async function status(db) {
  const control = await identify(db);
  let active = false;

  if (control.state === "loading") {
    await db.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw`
        SELECT pg_try_advisory_xact_lock(${LOCK_KEY}::bigint) AS acquired
      `;
      active = !lock.acquired;
    });
  }

  return {
    persistedState: control.state,
    effectiveState: effectiveState(control.state, active),
    active,
    runId: control.run_id,
    reason:
      control.state === "loading" && !active
        ? "Orphaned loading state: process ended or connection lost; authorization stays consumed"
        : undefined,
    smallMeasured: control.small_measured,
    counts: await countRows(db),
    report: control.report,
  };
}

function effectiveState(persistedState, active) {
  return persistedState === "loading" && !active ? "interrupted" : persistedState;
}

async function purge(db) {
  return exclusive(db, async () => {
    await identify(db);

    return db.$transaction(
      async (tx) => {
        const names = TABLES.map(([, table]) => `public."${table}"`).join(", ");
        await tx.$executeRaw(
          Prisma.sql`TRUNCATE TABLE ${Prisma.raw(names)} RESTRICT`,
        );
        const counts = await countRows(tx);

        if (Object.values(counts).some((count) => count !== 0)) {
          throw new Error("Purge did not leave all business tables empty");
        }

        await tx.$executeRaw`
        UPDATE scale_ops.control SET state = 'ready', updated_at = now(),
          report = report || jsonb_build_object('lastPurgeAt', now())
        WHERE singleton = true
      `;
        return { state: "ready", counts };
      },
      { timeout: 30000 },
    );
  });
}

async function consume(db, report) {
  await db.$transaction(async (tx) => {
    const [control] = await tx.$queryRaw`
      SELECT * FROM scale_ops.control WHERE singleton = true FOR UPDATE
    `;
    assertReady(control, await countRows(tx));
    const changed = await tx.$executeRaw`
      UPDATE scale_ops.control SET state = 'loading', run_id = ${report.runId},
        updated_at = now(), report = ${JSON.stringify(report)}::jsonb
      WHERE singleton = true AND state = 'ready'
    `;

    if (changed !== 1)
      throw new Error("Load authorization changed concurrently");
  });
}

async function saveReport(db, report, state = "loading") {
  if (Buffer.byteLength(JSON.stringify(report)) > 256 * 1024) {
    throw new Error("Operational report size limit exceeded");
  }

  const changed = await db.$executeRaw`
    UPDATE scale_ops.control SET state = ${state}, updated_at = now(),
      small_measured = small_measured OR (${state} = 'completed' AND ${report.profile} = 'small'),
      report = ${JSON.stringify(report)}::jsonb
    WHERE singleton = true AND run_id = ${report.runId} AND state = 'loading'
  `;

  if (changed !== 1)
    throw new Error("Operational run no longer owns loading state");
}

module.exports = {
  client,
  identify,
  countRows,
  assertReady,
  exclusive,
  status,
  purge,
  consume,
  saveReport,
  effectiveState,
};
