const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { createHash, randomUUID } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const os = require("node:os");
const assert = require("node:assert/strict");
const database = require("../scripts/scale/database");
const monitor = require("./supervisor");
const { preflight, machine } = require("./control");
const { requests, prepareOracle } = require("./oracles");
const { fingerprint } = require("./fingerprint");
const plan = require("./plan.json");
const { openCollector } = require("./live-collector");
const { validate } = require("../scripts/scale/validate");
const { config } = require("../scripts/scale/planner");
const LOCAL = path.join(__dirname, ".local");
const RESULTS = path.join(__dirname, "results");
const EXPECTED_SHA =
  "06a15d69869efb9261e6c132af64078731ad7d048095eaca05198daacb17686d";

function consumeReadAuthorization(directory, authorization, runId) {
  if (!authorization) {
    return;
  }
  if (!/^[a-zA-Z0-9.-]+$/.test(authorization)) {
    throw new Error("Invalid read authorization identifier");
  }
  fs.writeFileSync(
    path.join(directory, `${authorization}.consumed.json`),
    JSON.stringify({ runId, at: new Date().toISOString() }),
    { flag: "wx", mode: 0o600 },
  );
}

function readInterruptedMetrics(record, filename) {
  if (!record.authorization) {
    return;
  }
  try {
    const { metrics } = JSON.parse(fs.readFileSync(filename));
    const requests = metrics.http_reqs?.count;
    const operations = metrics.iterations?.count;
    if (
      ![requests, operations].every(
        (value) => Number.isInteger(value) && value >= 0,
      )
    ) {
      throw new Error("Incomplete k6 summary");
    }
    record.metrics = metrics;
    record.measuredRequests = requests;
    record.executedOperations = operations;
  } catch {
    record.measuredRequests = null;
    record.executedOperations = null;
    record.metricsUnavailable =
      "k6 did not leave a valid summary; executed requests are unknown";
  }
}

function k6() {
  const archive = path.join(LOCAL, "k6.zip");
  const binary = path.join(LOCAL, "tools/k6-v1.3.0-windows-amd64/k6.exe");
  if (
    createHash("sha256").update(fs.readFileSync(archive)).digest("hex") !==
    EXPECTED_SHA
  ) {
    throw new Error("k6 archive checksum differs from approved 1.3.0");
  }
  const version = spawnSync(binary, ["version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 10000,
  });
  if (
    version.status !== 0 ||
    !/^k6(?:\.exe)? v1\.3\.0\b/.test(version.stdout)
  ) {
    throw new Error("k6 version verification failed");
  }
  return {
    binary,
    version: version.stdout.trim(),
    archiveSha256: EXPECTED_SHA,
  };
}

function sourceVersion() {
  const call = (args) => {
    const result = spawnSync("git", args, {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 32768,
    });
    if (result.status !== 0) {
      throw new Error("Cannot record source revision/local changes");
    }
    return result.stdout.trim();
  };
  return {
    commit: call(["rev-parse", "HEAD"]),
    localChanges: call(["status", "--short"]),
  };
}

function k6Environment(scenario, stage) {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.toUpperCase().startsWith("K6_"),
    ),
  );
  return {
    ...inherited,
    SCENARIO: scenario,
    STAGE: stage,
    API_URL: plan.apiUrl,
    AUTHORIZE_READ: "marketplace_scale-small",
    SUPERVISED_READ: "verified-local-run",
    K6_NO_USAGE_REPORT: "true",
    K6_WEB_DASHBOARD: "false",
  };
}

async function watch(
  child,
  initial,
  gather,
  intervalMs = plan.stopPolicy.sampleSeconds * 1000,
  readMemory = () => os.freemem(),
  policy = plan.stopPolicy,
) {
  let finished = false;
  let exited;
  const done = new Promise((resolve) => {
    child.once("exit", (code) => {
      finished = true;
      exited = code;
      resolve();
    });
    child.once("error", () => {
      finished = true;
      exited = -1;
      resolve();
    });
  });
  const summary = monitor.aggregate();
  const state = {};
  let previous = initial;
  let nextSampleAt = Date.now() + intervalMs;
  let memoryTimer;
  let memoryFailure;
  summary.memorySamples = 0;
  const checkMemory = () => {
    if (finished || memoryFailure) {
      return;
    }
    const free = readMemory();
    summary.memorySamples += 1;
    if (Number.isFinite(free)) {
      summary.minHostFreeBytes = Math.min(
        summary.minHostFreeBytes ?? Infinity,
        free,
      );
    }
    if (!Number.isFinite(free) || free < policy.minimumAvailableMemoryBytes) {
      memoryFailure = new Error(
        `Host memory below ${policy.minimumAvailableMemoryBytes} bytes or unavailable during load`,
      );
      child.kill("SIGINT");
    }
  };
  try {
    monitor.accumulate(
      summary,
      initial,
      monitor.evaluate(initial, null, state, policy),
    );
    checkMemory();
    memoryTimer = setInterval(checkMemory, Math.min(250, intervalMs));
    while (!finished) {
      const timer = new AbortController();
      await Promise.race([
        done,
        delay(Math.max(0, nextSampleAt - Date.now()), undefined, {
          signal: timer.signal,
        }),
      ]);
      timer.abort();
      const current = await gather();
      if (memoryFailure) {
        throw memoryFailure;
      }
      const cpu = monitor.evaluate(current, previous, state, policy);
      monitor.accumulate(summary, current, cpu);
      previous = current;
      nextSampleAt += intervalMs;
    }
    if (exited !== 0) {
      throw new Error(
        `k6 stopped with exit code ${exited}; do not rerun silently`,
      );
    }
    if (summary.samples < 2) {
      throw new Error("Insufficient resource samples for this round");
    }
    return summary;
  } catch (error) {
    if (!finished) {
      child.kill("SIGINT");
      const ended = await Promise.race([
        done.then(() => true),
        delay(2000).then(() => false),
      ]);
      if (!ended) {
        child.kill();
      }
    }
    error.resourceSummary = summary;
    throw error;
  } finally {
    clearInterval(memoryTimer);
  }
}

async function main() {
  // Fail before connecting to PostgreSQL, starting processes or opening a run lock.
  const [scenario, variant, stage, endpoint] = process.argv.slice(2);
  if (
    stage === "reference" &&
    plan.reducedBaseline.executor === "node-http-minimal"
  ) {
    return require("./minimal-read").run({
      scenario,
      variant,
      stage,
      endpoint,
    });
  }
  const { selectRun, assertManifest, assertAuthorizedRead, memoryPolicy } =
    await import("./rules.mjs");
  const authorization = assertAuthorizedRead(
    plan,
    scenario,
    variant,
    stage,
    endpoint,
  );
  if (
    authorization &&
    fs.existsSync(path.join(LOCAL, `${authorization}.consumed.json`))
  ) {
    throw new Error(
      "Read authorization already consumed; new approval required before any HTTP",
    );
  }
  const policy = memoryPolicy(plan, scenario, stage);
  monitor.assertMemory(undefined, policy);
  const limits = selectRun(plan, scenario, stage);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(LOCAL, "read-manifest.json")),
  );
  assertManifest(manifest);
  const selection = requests(manifest, scenario, variant, endpoint);
  const tool = k6();
  const lock = path.join(LOCAL, "read-run.lock");
  const lockFile = fs.openSync(lock, "wx");
  fs.writeFileSync(
    lockFile,
    JSON.stringify({ pid: process.pid, at: new Date().toISOString() }),
  );
  const db = database.client();
  const id = `${scenario}-${variant}-${stage}-${randomUUID()}`;
  const record = {
    id,
    scenario,
    variant,
    stage,
    endpoint,
    tool: { version: tool.version, archiveSha256: tool.archiveSha256 },
    startedAt: new Date().toISOString(),
    machine: machine(),
    result: "preparing",
    measuredRequests: 0,
    plannedOperations: limits.operations,
    plannedRequests: limits.operations,
    vus: limits.vus,
    pauseSeconds: plan.http.thinkSeconds,
    timeoutSeconds: plan.http.timeoutSeconds,
    maxDurationSeconds: limits.maxDurationSeconds,
    memoryPolicy: {
      minimumStartAvailableMemoryBytes: policy.minimumStartAvailableMemoryBytes,
      minimumRunningAvailableMemoryBytes: policy.minimumAvailableMemoryBytes,
    },
    preparationMs: null,
  };
  const preparationStart = Date.now();
  try {
    record.source = sourceVersion();
    const control = await preflight(db, policy);
    record.environment = await monitor.environmentMetadata(db);
    await database.exclusive(
      db,
      async () => {
        const api = JSON.parse(
          fs.readFileSync(path.join(LOCAL, "api-process.json")),
        );
        record.api = api;
        const before = await fingerprint(db);
        record.baselineFingerprint = before;
        record.invariantsBefore = await validate(
          db,
          control.report.inserted,
          config.baseDateUtc,
        );
        if (manifest.runId !== (await database.identify(db)).run_id) {
          throw new Error("Session manifest belongs to another dataset");
        }
        const oracle = await prepareOracle(db, manifest, selection);
        fs.writeFileSync(
          path.join(LOCAL, "read-oracle.json"),
          JSON.stringify(oracle),
        );
        // Unmeasured bounded validation/warm-up: one GET per selected oracle, no retries.
        const { containsExpected } = await import("./rules.mjs");
        const warmStart = Date.now();
        for (const request of oracle) {
          const cookie =
            request.sellerIndex === undefined
              ? null
              : manifest.sellers[request.sellerIndex].cookie;
          const response = await fetch(`${plan.apiUrl}${request.path}`, {
            redirect: "error",
            signal: AbortSignal.timeout(10000),
            headers: cookie ? { Cookie: cookie } : {},
          });
          if (
            response.status !== 200 ||
            !containsExpected(await response.json(), request.expected)
          ) {
            throw new Error(
              "HTTP response differs from SQL oracle; no measured round started",
            );
          }
        }
        record.warmup = {
          requests: oracle.length,
          durationMs: Date.now() - warmStart,
        };
        const observerSetupAt = Date.now();
        const collector = await openCollector(db, api, control.storageSnapshot);
        record.observer = { setupMs: Date.now() - observerSetupAt };
        try {
          const detailedBefore = await collector.detailed();
          record.observer.detailedBefore = {
            at: detailedBefore.at,
            durationMs: detailedBefore.collectionMs,
            storage: detailedBefore.storage,
          };
          monitor.evaluate(detailedBefore, null, {}, policy);
          consumeReadAuthorization(LOCAL, authorization, id);
          record.authorization = authorization;
          fs.mkdirSync(RESULTS, { recursive: true });
          // Refresh after filesystem work; it can block for noticeable time on Windows.
          await new Promise(setImmediate);
          const initial = await collector.sample();
          monitor.assertMemory(initial.freeMemoryBytes, policy);
          record.observer.initialFreeMemoryBytes = initial.freeMemoryBytes;
          monitor.evaluate(initial, null, {}, policy);
          record.preparationMs = Date.now() - preparationStart;
          const summaryFile = path.join(RESULTS, `${id}-k6.json`);
          const measuredStart = Date.now();
          const child = spawn(
            tool.binary,
            [
              "run",
              "--summary-export",
              summaryFile,
              path.join(__dirname, "read.k6.js"),
            ],
            {
              cwd: __dirname,
              windowsHide: true,
              stdio: ["ignore", "ignore", "ignore"],
              env: k6Environment(scenario, stage),
            },
          );
          record.launchMs = Date.now() - measuredStart;
          const abort = () => child.kill("SIGINT");
          process.on("SIGINT", abort);
          process.on("SIGTERM", abort);
          try {
            record.resources = await watch(
              child,
              initial,
              () => collector.sample(),
              1000,
              undefined,
              policy,
            );
          } finally {
            process.off("SIGINT", abort);
            process.off("SIGTERM", abort);
            record.windowWithMonitorMs = Date.now() - measuredStart;
          }
          const data = JSON.parse(fs.readFileSync(summaryFile));
          record.metrics = data.metrics;
          record.measuredRequests =
            data.metrics.http_reqs?.count ??
            data.metrics.http_reqs?.values?.count ??
            0;
          record.executedOperations =
            data.metrics.iterations?.count ??
            data.metrics.iterations?.values?.count ??
            0;
          assert.equal(
            record.measuredRequests,
            record.plannedRequests,
            "Incomplete HTTP budget",
          );
          assert.equal(
            record.executedOperations,
            record.plannedOperations,
            "Incomplete operation budget",
          );
          const verificationStarted = Date.now();
          const checks = await fingerprint(db);
          assert.deepEqual(
            checks,
            before,
            "Historical records changed during read-only round",
          );
          record.verificationMs = Date.now() - verificationStarted;
          record.integrity = { before, after: checks, equal: true };
          record.invariantsAfter = await validate(
            db,
            control.report.inserted,
            config.baseDateUtc,
          );
          const detailedAfter = await collector.detailed();
          monitor.evaluate(detailedAfter, null, {}, policy);
          record.observer.detailedAfter = {
            at: detailedAfter.at,
            durationMs: detailedAfter.collectionMs,
            storage: detailedAfter.storage,
          };
          record.result = "completed";
        } finally {
          await collector.close();
        }
      },
      (limits.maxDurationSeconds + 120) * 1000,
    );
  } catch (error) {
    record.result = "interrupted";
    record.reason = error.message;
    record.resources ??= error.resourceSummary;
    try {
      readInterruptedMetrics(record, path.join(RESULTS, `${id}-k6.json`));
      if (record.baselineFingerprint) {
        const after = await fingerprint(db);
        record.integrity = {
          before: record.baselineFingerprint,
          after,
          equal:
            JSON.stringify(after) ===
            JSON.stringify(record.baselineFingerprint),
        };
      }
    } catch {
      record.reconciliationUnavailable = true;
    }
    throw error;
  } finally {
    fs.mkdirSync(RESULTS, { recursive: true });
    const report = JSON.stringify(record, null, 2);
    if (Buffer.byteLength(report) <= 256 * 1024) {
      fs.writeFileSync(path.join(RESULTS, `${id}-run.json`), report);
    }
    await db.$disconnect();
    fs.closeSync(lockFile);
    fs.unlinkSync(lock);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  watch,
  k6,
  k6Environment,
  consumeReadAuthorization,
  readInterruptedMetrics,
};
