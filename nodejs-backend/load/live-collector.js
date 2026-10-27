const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { performance } = require("node:perf_hooks");
const { memoryBytes, cpuClock } = require("./supervisor");
const execute = promisify(execFile);

function statsLine(raw, expectedContainer = "marketplace-scale-postgres") {
  const line = raw.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").trim();
  if (!line) {
    return null;
  }
  const row = JSON.parse(line);
  if (row.Name !== expectedContainer) {
    throw new Error("Unexpected container in resource stream");
  }
  const cpu = Number(row.CPUPerc.replace("%", ""));
  const memory = memoryBytes(row.MemUsage.split("/")[0]);
  if (
    !Number.isFinite(cpu) ||
    !Number.isFinite(memory) ||
    cpu < 0 ||
    memory < 0
  ) {
    throw new Error("Missing Docker CPU/memory values");
  }
  return { at: Date.now(), cpu, memory };
}

function fresh(at, now = Date.now()) {
  if (!Number.isFinite(at) || now < at || now - at > 4000) {
    throw new Error("Periodic resource sample is missing or stale");
  }
}

async function openCollector(db, api, baseline, options = {}) {
  const container = options.container || "marketplace-scale-postgres";
  const dataPath = options.dataPath || "/var/lib/postgresql/data/pgdata";
  const metricsFile =
    options.metricsFile || path.join(__dirname, ".local/api-metrics.json");
  if (
    !["marketplace-scale-postgres", "marketplace-load-test-postgres"].includes(
      container,
    ) ||
    !["/var/lib/postgresql/data", "/var/lib/postgresql/data/pgdata"].includes(
      dataPath,
    )
  ) {
    throw new Error("Resource collection target is not allowed");
  }
  let latest;
  let failure;
  let stopped = false;
  let buffer = "";
  const child = spawn(
    "docker",
    ["stats", container, "--format", "{{json .}}"],
    {
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    },
  );
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const timeout = setTimeout(
    () => readyReject(new Error("Docker stats stream unavailable")),
    10000,
  );
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    if (buffer.length > 65536) {
      failure = new Error("Docker stats stream exceeded its buffer limit");
      readyReject(failure);
      return;
    }
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) {
        continue;
      }
      try {
        const parsed = statsLine(line, container);
        if (parsed) {
          latest = parsed;
          readyResolve();
        }
      } catch {
        failure = new Error("Invalid Docker stats stream");
        readyReject(failure);
      }
    }
  });
  child.once("error", (error) => {
    failure = error;
    readyReject(error);
  });
  child.once("exit", () => {
    if (!stopped) {
      failure = new Error("Docker stats stream stopped unexpectedly");
      readyReject(failure);
    }
  });
  const close = async () => {
    stopped = true;
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) {
      const done = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGINT");
      await done;
    }
  };
  try {
    await ready;
    clearTimeout(timeout);
  } catch (error) {
    await close();
    throw error;
  }
  return {
    close,
    async detailed() {
      const started = performance.now();
      const result = await this.sample();
      const { stdout } = await execute(
        "docker",
        [
          "exec",
          container,
          "sh",
          "-c",
          `du -sk /var/lib/postgresql/data; du -sk ${dataPath}/pg_wal`,
        ],
        {
          encoding: "utf8",
          windowsHide: true,
          timeout: 10000,
          maxBuffer: 4096,
        },
      );
      const sizes = stdout
        .trim()
        .split(/\r?\n/)
        .map((line) => Number(line.split(/\s+/)[0]) * 1024);
      if (
        sizes.length !== 2 ||
        sizes.some((value) => !Number.isFinite(value) || value < 0)
      ) {
        throw new Error("Exact PostgreSQL directory measurement unavailable");
      }
      result.storage.postgresDirectoryBytes = sizes[0];
      result.storage.walDirectoryBytes = sizes[1];
      result.storage.directoryMode = "exact du outside measured window";
      result.collectionMs = performance.now() - started;
      result.at = Date.now();
      return result;
    },
    async sample() {
      const started = performance.now();
      if (failure) {
        throw failure;
      }
      fresh(latest?.at);
      const process = JSON.parse(fs.readFileSync(metricsFile, "utf8"));
      fresh(process.at);
      if (
        !Number.isFinite(Date.parse(process.startedAt)) ||
        !Number.isFinite(Date.parse(api.startedAt)) ||
        process.pid !== api.pid ||
        Math.abs(Date.parse(process.startedAt) - Date.parse(api.startedAt)) >
          2000
      ) {
        throw new Error("API metrics identity changed");
      }
      const [row] = await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
          return tx.$queryRaw`
          SELECT pg_database_size(current_database())::float8 AS "databaseBytes",
            (SELECT coalesce(sum(size),0)::float8 FROM pg_ls_waldir()) AS "walBytes",
            (SELECT coalesce(sum(size),0)::float8 FROM pg_ls_tmpdir()) AS "tempBytes",
            count(*)::integer AS connections,
            count(*) FILTER (WHERE state='active' AND pid<>pg_backend_pid())::integer AS active,
            count(*) FILTER (WHERE wait_event_type='Lock')::integer AS waiting,
            coalesce(max(extract(epoch FROM clock_timestamp()-query_start)) FILTER (WHERE wait_event_type='Lock'),0)::float8 AS "maxLockSeconds",
            (SELECT coalesce(json_agg(q),'[]'::json) FROM (
              SELECT md5(query) AS fingerprint,wait_event_type AS "waitType",
                extract(epoch FROM clock_timestamp()-query_start)::float8 AS seconds
              FROM pg_stat_activity WHERE datname=current_database() AND state='active'
                AND pid<>pg_backend_pid() AND query_start<clock_timestamp()-interval '1 second'
              ORDER BY query_start,pid LIMIT 5
            ) q) AS slow
          FROM pg_stat_activity WHERE datname=current_database()
        `;
        },
        { timeout: 3000 },
      );
      const disk = fs.statfsSync(baseline.windowsDrive);
      const storage = {
        ...baseline,
        measuredAt: new Date().toISOString(),
        databaseBytes: row.databaseBytes,
        walDirectoryBytes: row.walBytes,
        postgresDirectoryBytes:
          baseline.postgresDirectoryBytes +
          Math.max(0, row.databaseBytes - baseline.databaseBytes) +
          Math.max(0, row.walBytes - baseline.walDirectoryBytes) +
          row.tempBytes,
        windowsFreeBytes: disk.bavail * disk.bsize,
        directoryMode:
          "conservative baseline + positive database/WAL deltas + temporary bytes; exact du before/after",
      };
      return {
        at: Date.now(),
        clock: cpuClock(),
        freeMemoryBytes: os.freemem(),
        process,
        postgresCpuCorePercent: latest.cpu,
        postgresMemoryBytes: latest.memory,
        activity: {
          connections: row.connections,
          active: row.active,
          waiting: row.waiting,
          maxLockSeconds: row.maxLockSeconds,
        },
        slow: row.slow,
        storage,
        collectionMs: performance.now() - started,
        sourceTimes: { api: process.at, docker: latest.at },
      };
    },
  };
}

module.exports = { openCollector, fresh, statsLine };
