const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { spawn } = require("node:child_process");
const { randomBytes, randomUUID } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const target = require("./fixture-db");
const fixtures = require("./fixture-manager");
const scripts = require("./write-scenarios");
const monitor = require("./supervisor");
const { watch } = require("./run-read");
const { openCollector } = require("./live-collector");
const plan = require("./plan.json");
const LOCAL = path.join(__dirname, ".local");
const RESULTS = path.join(__dirname, "results");

function limitsFor(stage, manifest, approval, mode) {
  const reference =
    stage === "reference" &&
    manifest.reference &&
    plan.reducedBaseline.enabled &&
    plan.reducedBaseline.writeScenarios.includes(manifest.scenario);
  if (mode === "scale" && !plan.fixtures.writesEnabled && !reference) {
    throw new Error(
      "Scale write execution is administratively disabled pending explicit authorization",
    );
  }
  const limits = reference
    ? plan.reducedBaseline.write
    : plan.writeStages[stage];
  if (!limits || manifest.requestedOperations !== limits.operations) {
    throw new Error(
      "Fixture operation budget must match the explicit write stage",
    );
  }
  const destination =
    mode === "scale" ? "http://127.0.0.1:8051" : "http://127.0.0.1:8052";
  scripts.assertMode(mode, destination, approval, manifest, stage);
  return limits;
}

function quantile(sorted, fraction) {
  if (!sorted.length) {
    return null;
  }
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  return (
    sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower)
  );
}

function transportFor(
  manifest,
  destination,
  sessions,
  signal,
  fetcher = fetch,
) {
  if (
    !["http://127.0.0.1:8051", "http://127.0.0.1:8052"].includes(destination)
  ) {
    throw new Error("Write HTTP destination is not allowed");
  }
  const observations = [];
  let stopped = false;
  let inFlight = 0;
  let peakInFlight = 0;
  const transport = async (request) => {
    if (stopped) {
      throw new Error("Write dispatch stopped after an unknown result");
    }
    const customer = manifest.customers.find(
      (c) => c.userId === request.userId,
    );
    const allowed =
      customer &&
      ((manifest.scenario === "cart" &&
        ((request.method === "POST" && request.path === "/cart/items") ||
          (request.method === "PUT" &&
            request.path === `/cart/items/${customer.productId}`))) ||
        (manifest.scenario === "payment" &&
          request.method === "POST" &&
          request.path === `/orders/${customer.orderId}/payment-attempts`) ||
        (["checkout-shared", "checkout-distinct", "idempotency"].includes(
          manifest.scenario,
        ) &&
          request.method === "POST" &&
          request.path === "/checkout"));
    if (
      !allowed ||
      !sessions.has(request.userId) ||
      observations.length >= 40
    ) {
      throw new Error("Write request outside fixture allowlist or budget");
    }
    signal.throwIfAborted();
    const started = performance.now();
    inFlight += 1;
    peakInFlight = Math.max(peakInFlight, inFlight);
    try {
      const response = await fetcher(`${destination}${request.path}`, {
        method: request.method,
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
        headers: {
          "Content-Type": "application/json",
          Cookie: sessions.get(request.userId),
          ...(request.headers?.["Idempotency-Key"]
            ? { "Idempotency-Key": request.headers["Idempotency-Key"] }
            : {}),
        },
        body: JSON.stringify(request.body),
      });
      let body;
      try {
        body = await response.json();
      } catch {
        throw new Error(
          "Invalid write response; reconcile before any recovery",
        );
      }
      observations.push({
        status: response.status,
        milliseconds: performance.now() - started,
      });
      return {
        status: response.status,
        body,
        headers: {
          "Idempotency-Replayed": response.headers.get("idempotency-replayed"),
        },
      };
    } catch (error) {
      stopped = true;
      observations.push({
        status: null,
        milliseconds: performance.now() - started,
      });
      throw error;
    } finally {
      inFlight -= 1;
    }
  };
  return {
    transport,
    aggregate() {
      const times = observations
        .filter((r) => r.status !== null)
        .map((r) => r.milliseconds)
        .sort((a, b) => a - b);
      return {
        dispatched: observations.length,
        peakInFlight,
        responses: times.length,
        unknown: observations.length - times.length,
        p50Ms: quantile(times, 0.5),
        p95Ms: quantile(times, 0.95),
        p99Ms: quantile(times, 0.99),
      };
    },
  };
}

async function startApi(db) {
  const descriptor = target.descriptor(db);
  fs.mkdirSync(LOCAL, { recursive: true });
  const metricsFile = path.join(LOCAL, `write-api-${descriptor.mode}.json`);
  const child = spawn(
    process.execPath,
    [path.join(__dirname, "api-entry.js")],
    {
      windowsHide: true,
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      env: {
        ...process.env,
        ...target.apiEnvironment(db),
        NODE_ENV: "production",
        JWT_SECRET: randomBytes(48).toString("hex"),
        CLOUDINARY_CLOUD_NAME: "load-disabled",
        CLOUDINARY_API_KEY: "load-disabled",
        CLOUDINARY_API_SECRET: "load-disabled",
      },
    },
  );
  const exited = new Promise((resolve) => child.once("exit", resolve));
  const close = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGINT");
      await exited;
    }
  };
  let timer;
  try {
    const identity = await new Promise((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error("Dedicated write API did not become ready")),
        45000,
      );
      child.once("error", reject);
      child.once("exit", () =>
        reject(new Error("Dedicated write API exited before readiness")),
      );
      child.on("message", (message) => {
        if (!["ready", "metrics"].includes(message?.type)) {
          return;
        }
        try {
          const temporary = `${metricsFile}.tmp`;
          fs.writeFileSync(temporary, JSON.stringify(message.metrics), {
            mode: 0o600,
          });
          fs.renameSync(temporary, metricsFile);
          if (message.type === "ready") {
            resolve({ pid: child.pid, startedAt: message.metrics.startedAt });
          }
        } catch {
          reject(new Error("API telemetry could not be persisted"));
          child.kill("SIGINT");
        }
      });
    });
    return { identity, metricsFile, close };
  } catch (error) {
    await close();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function sessionsFor(manifest, destination) {
  const sessions = new Map();
  for (const [index, customer] of manifest.customers.entries()) {
    const response = await fetch(`${destination}/users/login`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${manifest.namespace}.${index}@local.invalid`,
        password: "load-fixture-only",
      }),
    });
    const match = response.headers
      .get("set-cookie")
      ?.match(/(?:^|,\s*)token=([^;]+)/);
    if (response.status !== 200 || !match) {
      throw new Error("Experimental customer login failed");
    }
    const cookie = `token=${match[1]}`;
    const identity = await fetch(`${destination}/users/me`, {
      headers: { Cookie: cookie },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    const user = identity.status === 200 ? await identity.json() : null;
    if (user?.id !== customer.userId || user?.role !== "CUSTOMER") {
      throw new Error("Experimental customer identity mismatch");
    }
    sessions.set(customer.userId, cookie);
  }
  return sessions;
}

async function execute(
  db,
  { stage, approval, paymentVariant = "duplicate", hooks = {} },
) {
  target.assertWrite(db);
  await target.identify(db);
  const control = await fixtures.status(db);
  if (control.state !== "READY" || control.effects?.execution) {
    throw new Error(
      "A fresh READY fixture is required; no repeat is permitted",
    );
  }
  const descriptor = target.descriptor(db);
  const policy = target.policy(db);
  const limits = limitsFor(stage, control.manifest, approval, descriptor.mode);
  const report = {
    id: `write-${randomUUID()}`,
    namespace: control.namespace,
    environment: descriptor.mode,
    scenario: control.manifest.scenario,
    stage,
    limits,
    startedAt: new Date().toISOString(),
    result: "preparing",
  };
  let api;
  let collector;
  const aborted = new AbortController();
  const stop = () =>
    aborted.abort(
      new Error("Write interrupted; explicit reconciliation required"),
    );
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const preparedAt = performance.now();
  try {
    await fixtures.reconcile(db);
    await target.guardStorage(db);
    api = await startApi(db);
    if (descriptor.reference) {
      report.memoryPhases = require("./minimal").recordMemory(
        descriptor.mode,
        "api",
      );
    }
    const sessions = await sessionsFor(control.manifest, descriptor.apiUrl);
    const storage = await target.guardStorage(db);
    const setupAt = performance.now();
    collector = descriptor.reference
      ? require("./minimal").collector(storage, policy, () =>
          target.guardStorage(db),
        )
      : await openCollector(db, api.identity, storage, {
          ...descriptor,
          metricsFile: api.metricsFile,
        });
    report.observer = { setupMs: performance.now() - setupAt };
    const before = await collector.detailed();
    report.observer.before = {
      at: before.at,
      milliseconds: before.collectionMs,
      storage: before.storage,
    };
    report.preparationMs = performance.now() - preparedAt;
    const http = transportFor(
      control.manifest,
      descriptor.apiUrl,
      sessions,
      aborted.signal,
      hooks.fetcher,
    );
    try {
      await fixtures.runTest(db, async (manifest) => {
        assert.equal(
          manifest.namespace,
          control.namespace,
          "Fixture changed before execution",
        );
        const initial = await collector.sample();
        monitor.assertMemory(initial.freeMemoryBytes, policy);
        report.initialFreeMemoryBytes = initial.freeMemoryBytes;
        const child = new EventEmitter();
        child.kill = stop;
        const observe = descriptor.reference
          ? require("./minimal").watch
          : watch;
        const observing = observe(
          child,
          initial,
          () => collector.sample(),
          1000,
          undefined,
          policy,
        );
        const deadline = setTimeout(stop, limits.maxDurationSeconds * 1000);
        const measuredAt = performance.now();
        let measuredEnd;
        const operation = scripts.run({
          manifest,
          operations: limits.operations,
          concurrency: limits.vus,
          mode: descriptor.mode,
          destination: descriptor.apiUrl,
          approval,
          stage,
          paymentVariant,
          signal: aborted.signal,
          pauseMs: stage === "reference" ? 0 : 1000,
          transport: http.transport,
          inspect: async (m) => {
            measuredEnd = performance.now();
            clearTimeout(deadline);
            child.emit("exit", 0);
            // Finish live sampling before identity checks run synchronous Docker commands.
            // Verification is outside the HTTP window and must not stall its collector.
            await observing;
            const verificationAt = performance.now();
            const result = await scripts.inspectTestDb(db, m);
            report.verificationMs = performance.now() - verificationAt;
            return result;
          },
        });
        operation.then(
          () => child.emit("exit", 0),
          () => child.emit("exit", 1),
        );
        const results = await Promise.allSettled([operation, observing]);
        clearTimeout(deadline);
        report.measuredMs = (measuredEnd || performance.now()) - measuredAt;
        if (results[1].status === "fulfilled") {
          report.resources = results[1].value;
        }
        const failure = results.find((r) => r.status === "rejected");
        if (failure) {
          report.resources ||= failure.reason.resourceSummary;
          report.business = failure.reason.writeSummary;
          throw failure.reason;
        }
        report.business = results[0].value;
        report.operationsPerSecond =
          report.business.operations / (report.measuredMs / 1000);
        report.requestsPerSecond =
          report.business.requests / (report.measuredMs / 1000);
      });
      const after = await collector.detailed();
      if (!descriptor.reference) {
        monitor.evaluate(after, null, {}, policy);
      }
      report.observer.after = {
        at: after.at,
        milliseconds: after.collectionMs,
        storage: after.storage,
      };
      report.reconciliation = await fixtures.reconcile(db);
      report.result = "completed-awaiting-explicit-recovery";
      return report;
    } finally {
      report.http = http.aggregate();
    }
  } catch (error) {
    report.result = "interrupted-reconcile-no-retry";
    report.reason = error.message;
    throw Object.assign(error, { report });
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await collector?.close();
    await api?.close();
    fs.mkdirSync(RESULTS, { recursive: true });
    const serialized = JSON.stringify(report, null, 2);
    assert.ok(
      Buffer.byteLength(serialized) <= 256 * 1024,
      "Bounded write report required",
    );
    fs.writeFileSync(path.join(RESULTS, `${report.id}.json`), serialized, {
      mode: 0o600,
    });
  }
}

module.exports = { execute, limitsFor, transportFor, quantile };
