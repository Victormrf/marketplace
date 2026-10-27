const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { EventEmitter } = require("node:events");
const { performance } = require("node:perf_hooks");
const { setTimeout: pause } = require("node:timers/promises");
const database = require("../scripts/scale/database");
const environment = require("../scripts/scale/environment");
const { config } = require("../scripts/scale/planner");
const { validate } = require("../scripts/scale/validate");
const { fingerprint } = require("./fingerprint");
const { preflight } = require("./control");
const { prepareOracle, requests } = require("./oracles");
const { assertMemory } = require("./supervisor");
const minimal = require("./minimal");
const plan = require("./plan.json");
const LOCAL = path.join(__dirname, ".local");
const RESULTS = path.join(__dirname, "results");

function summary(values) {
  if (!values.length) {
    return { minimumMs: null, medianMs: null, maximumMs: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const center = Math.floor(sorted.length / 2);
  return {
    minimumMs: sorted[0],
    medianMs:
      sorted.length % 2
        ? sorted[center]
        : (sorted[center - 1] + sorted[center]) / 2,
    maximumMs: sorted.at(-1),
  };
}

async function run(selection) {
  const rules = await import("./rules.mjs");
  const authorization = rules.assertAuthorizedRead(
    plan,
    selection.scenario,
    selection.variant,
    selection.stage,
    selection.endpoint,
  );
  const policy = rules.memoryPolicy(plan, selection.scenario, selection.stage);
  assertMemory(undefined, policy);
  assert.match(authorization, /^[a-zA-Z0-9.-]+$/);
  const ticket = path.join(LOCAL, `${authorization}.consumed.json`);
  if (fs.existsSync(ticket)) {
    throw new Error("Minimal experiment already consumed; do not repeat");
  }
  const manifest = JSON.parse(
    fs.readFileSync(path.join(LOCAL, "read-manifest.json")),
  );
  rules.assertManifest(manifest);
  const id = `${selection.scenario}-minimal-${randomUUID()}`;
  const report = {
    id,
    ...selection,
    executor: "node-http-minimal",
    node: process.version,
    configuration: plan.reducedBaseline.id,
    startedAt: new Date().toISOString(),
    plannedRequests: 5,
    attemptedRequests: 0,
    completedRequests: 0,
    validatedRequests: 0,
    individualLatenciesMs: [],
    statuses: [],
    result: "preparing",
  };
  const file = path.join(LOCAL, "read-run.lock");
  const lock = fs.openSync(file, "wx");
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, id }));
  const db = database.client();
  const abort = new AbortController();
  const stop = () =>
    abort.abort(new Error("Minimal read interrupted; no automatic retry"));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  let collector;
  let baseline;
  const preparedAt = performance.now();
  try {
    const control = await preflight(db, policy);
    assert.equal(manifest.runId, control.run_id);
    await database.exclusive(
      db,
      async () => {
        baseline = await fingerprint(db);
        report.baseline = baseline;
        report.invariantsBefore = await validate(
          db,
          control.report.inserted,
          config.baseDateUtc,
        );
        const api = JSON.parse(
          fs.readFileSync(path.join(LOCAL, "api-process.json")),
        );
        process.kill(api.pid, 0); // Only verifies existence; does not signal/terminate another process.
        report.memoryPhases = api.memoryPhases;
        const oracle = await prepareOracle(
          db,
          manifest,
          requests(
            manifest,
            selection.scenario,
            selection.variant,
            selection.endpoint,
          ),
        );
        assert.equal(oracle.length, 1);
        const request = oracle[0];
        report.target = request.path;
        const headers =
          request.sellerIndex === undefined
            ? {}
            : { Cookie: manifest.sellers[request.sellerIndex].cookie };
        const validateResponse = async (signal) => {
          const response = await fetch(`${plan.apiUrl}${request.path}`, {
            headers,
            redirect: "error",
            signal,
          });
          if (
            response.status !== 200 ||
            !rules.containsExpected(await response.json(), request.expected)
          ) {
            throw new Error("Minimal response differs from the SQL oracle");
          }
          return response.status;
        };
        // The authorization is five target GETs total: do not add a sixth warm-up.
        report.warmup = { requests: 0, milliseconds: 0 };
        collector = minimal.collector(control.storageSnapshot, policy, () =>
          environment.measureStorage(db),
        );
        report.storageBefore = await collector.detailed();
        fs.writeFileSync(
          ticket,
          JSON.stringify({ id, at: new Date().toISOString() }),
          { flag: "wx", mode: 0o600 },
        );
        await new Promise(setImmediate);
        const initial = await collector.sample();
        assertMemory(initial.freeMemoryBytes, policy);
        report.initialAvailableBytes = initial.freeMemoryBytes;
        report.preparationMs = performance.now() - preparedAt;
        const child = new EventEmitter();
        child.kill = stop;
        const observing = minimal.watch(
          child,
          initial,
          () => collector.sample(),
          100,
          undefined,
          policy,
        );
        const deadline = setTimeout(stop, 60000);
        const measuredAt = performance.now();
        const operation = (async () => {
          for (let index = 0; index < 5; index += 1) {
            abort.signal.throwIfAborted();
            report.attemptedRequests += 1;
            const started = performance.now();
            const status = await validateResponse(
              AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]),
            );
            report.individualLatenciesMs.push(performance.now() - started);
            report.statuses.push(status);
            report.completedRequests += 1;
            report.validatedRequests += 1;
            if (index < 4) {
              await pause(1000, undefined, { signal: abort.signal });
            }
          }
        })();
        operation.then(
          () => child.emit("exit", 0),
          () => child.emit("exit", 1),
        );
        const result = await Promise.allSettled([operation, observing]);
        clearTimeout(deadline);
        report.measuredMs = performance.now() - measuredAt;
        report.latencies = summary(report.individualLatenciesMs);
        report.requestsPerSecond =
          report.completedRequests / (report.measuredMs / 1000);
        report.resources =
          result[1].status === "fulfilled"
            ? result[1].value
            : result[1].reason.resourceSummary;
        const failed = result.find((entry) => entry.status === "rejected");
        if (failed) {
          throw failed.reason;
        }
        const verificationAt = performance.now();
        const after = await fingerprint(db);
        assert.deepEqual(after, baseline);
        report.invariantsAfter = await validate(
          db,
          control.report.inserted,
          config.baseDateUtc,
        );
        report.integrity = {
          equal: true,
          reference: "this experiment before/after",
        };
        report.verificationMs = performance.now() - verificationAt;
        report.storageAfter = await collector.detailed();
        report.result = "completed";
      },
      120000,
    );
    return report;
  } catch (error) {
    report.result = "interrupted-no-retry";
    report.reason = error.message;
    if (baseline) {
      try {
        report.integrity = {
          equal:
            JSON.stringify(await fingerprint(db)) === JSON.stringify(baseline),
        };
      } catch {
        report.reconciliationUnavailable = true;
      }
    }
    throw error;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await collector?.close();
    await db.$disconnect();
    fs.closeSync(lock);
    fs.unlinkSync(file);
    fs.mkdirSync(RESULTS, { recursive: true });
    const data = JSON.stringify(report, null, 2);
    assert.ok(Buffer.byteLength(data) <= 256 * 1024);
    fs.writeFileSync(path.join(RESULTS, `${id}-run.json`), data);
  }
}

module.exports = { run, summary };
