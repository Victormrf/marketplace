const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  evaluate,
  aggregate,
  accumulate,
  memoryBytes,
  assertMemory,
} = require("../load/supervisor");
const { watch: supervisedWatch, k6Environment } = require("../load/run-read");
const { requests, prepareOracle } = require("../load/oracles");
const { fingerprint } = require("../load/fingerprint");
const { TABLES } = require("../scripts/scale/records");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const GIB = 1024 ** 3;

test("a read authorization is consumed atomically and cannot be repeated", () => {
  const directory = fs.mkdtempSync(
    path.join(require("node:os").tmpdir(), "load-read-permit-"),
  );
  const { consumeReadAuthorization } = require("../load/run-read");
  try {
    consumeReadAuthorization(directory, "unit-catalog-low", "round-one");
    assert.throws(() =>
      consumeReadAuthorization(directory, "unit-catalog-low", "round-two"),
    );
    assert.throws(() =>
      consumeReadAuthorization(directory, "../another-path", "round-two"),
    );
    assert.equal(
      JSON.parse(
        fs.readFileSync(path.join(directory, "unit-catalog-low.consumed.json")),
      ).runId,
      "round-one",
    );
    const { readInterruptedMetrics } = require("../load/run-read");
    const record = { authorization: "unit-catalog-low", measuredRequests: 0 };
    readInterruptedMetrics(
      record,
      path.join(directory, "missing-summary.json"),
    );
    assert.equal(record.measuredRequests, null);
    assert.equal(record.executedOperations, null);
    assert.match(record.metricsUnavailable, /unknown/);
    const partial = path.join(directory, "partial-summary.json");
    fs.writeFileSync(partial, '{"metrics":');
    readInterruptedMetrics(record, partial);
    assert.equal(record.measuredRequests, null);
  } finally {
    assert.ok(
      path
        .resolve(directory)
        .startsWith(path.resolve(require("node:os").tmpdir()) + path.sep),
    );
    assert.ok(path.basename(directory).startsWith("load-read-permit-"));
    fs.rmSync(directory, { recursive: true });
  }
});

function watch(process, initial, gather, interval) {
  return supervisedWatch(process, initial, gather, interval, () => 4 * GIB, {
    ...require("../load/plan.json").stopPolicy,
    ...require("../load/plan.json").readSmokeMemory,
  });
}

function measurement(index = 0) {
  return {
    at: 100000 + index * 5000,
    freeMemoryBytes: 4 * GIB,
    clock: { total: 100000 + index * 10000, idle: 80000 + index * 8000 },
    process: { cpuMs: index * 250, workingSetBytes: 70e6, privateBytes: 60e6 },
    postgresCpuCorePercent: 4,
    postgresMemoryBytes: 80e6,
    activity: { connections: 7, active: 1, waiting: 0, maxLockSeconds: 0 },
    slow: [],
    storage: {
      databaseBytes: 25e6,
      postgresDirectoryBytes: 90e6,
      walDirectoryBytes: 32e6,
      windowsFreeBytes: 30 * GIB,
      writableLayerBytes: 24000,
      boundedLogBytes: 30e6,
    },
    collectionMs: 100,
  };
}

function child() {
  const value = new EventEmitter();
  value.signals = [];
  value.kill = (signal = "SIGTERM") => {
    value.signals.push(signal);
    value.emit("exit", 130);
    return true;
  };
  return value;
}

test("memory guard refuses unsafe/missing measurements before API or load", () => {
  for (const bytes of [undefined, NaN, -1, 0, 2 * GIB - 1]) {
    if (bytes !== undefined) {
      assert.throws(() => assertMemory(bytes), /memory/);
    }
  }
  assert.doesNotThrow(() => assertMemory(2 * GIB));
  const smoke = {
    ...require("../load/plan.json").stopPolicy,
    ...require("../load/plan.json").readSmokeMemory,
  };
  assert.doesNotThrow(() => assertMemory(1.25 * GIB, smoke));
  assert.throws(() => assertMemory(1.25 * GIB - 1, smoke));
  const sample = measurement();
  sample.freeMemoryBytes = GIB - 1;
  assert.throws(() => evaluate(sample, null, {}), /memory/);
  sample.freeMemoryBytes = GIB;
  assert.doesNotThrow(() => evaluate(sample, null, {}, smoke));
  assert.throws(() => assertMemory(sample.freeMemoryBytes, smoke));
});

test("k6 child cannot inherit external outputs or option overrides", () => {
  const env = k6Environment("product", "smoke");
  assert.equal(env.API_URL, "http://127.0.0.1:8051");
  assert.equal(env.K6_NO_USAGE_REPORT, "true");
  assert.equal(env.K6_WEB_DASHBOARD, "false");
  assert.equal(env.K6_OUT, undefined);
  assert.equal(env.K6_CLOUD_TOKEN, undefined);
  assert.deepEqual(
    Object.keys(env)
      .filter((key) => key.toUpperCase().startsWith("K6_"))
      .sort(),
    ["K6_NO_USAGE_REPORT", "K6_WEB_DASHBOARD"],
  );
});

test("only the two reference reads are authorized and memory relaxation stays scoped", async () => {
  const { assertAuthorizedRead, memoryPolicy } =
    await import("../load/rules.mjs");
  const actual = require("../load/plan.json");
  const plan = structuredClone(actual);
  plan.reducedBaseline.enabled = true;
  const inactive = structuredClone(plan);
  inactive.reducedBaseline.enabled = false;
  assert.throws(() =>
    assertAuthorizedRead(inactive, "product", "popular-one", "reference"),
  );
  assert.doesNotThrow(() =>
    assertAuthorizedRead(plan, "product", "popular-one", "reference"),
  );
  assert.doesNotThrow(() =>
    assertAuthorizedRead(
      plan,
      "dashboard",
      "high",
      "reference",
      "/dashboard/seller/summary",
    ),
  );
  for (const values of [
    ["catalog", "all", "smoke"],
    ["catalog", "filtered1", "low"],
    ["product", "popular", "low"],
    ["dashboard", "high", "low"],
    ["catalog", "all", "gradual"],
    ["payment", "all", "smoke"],
    ["catalog", "all", "low"],
    ["dashboard", "high", "reference", "/dashboard/seller/orders"],
    ["product", "popular", "reference"],
  ]) {
    assert.throws(
      () => assertAuthorizedRead(plan, ...values),
      /not explicitly authorized/,
    );
  }
  assert.throws(() =>
    assertAuthorizedRead(plan, "product", "popular", "smoke"),
  );
  assert.equal(
    memoryPolicy(plan, "catalog", "smoke").minimumStartAvailableMemoryBytes,
    1.25 * GIB,
  );
  assert.equal(
    memoryPolicy(plan, "product", "reference").minimumAvailableMemoryBytes,
    0,
  );
  for (const pair of [
    ["catalog", "low"],
    ["product", "gradual"],
    ["cart", "smoke"],
    ["payment", "smoke"],
  ]) {
    assert.equal(
      memoryPolicy(plan, ...pair).minimumStartAvailableMemoryBytes,
      2 * GIB,
    );
    assert.equal(
      memoryPolicy(plan, ...pair).minimumAvailableMemoryBytes,
      2 * GIB,
    );
  }
});

test("unavailable CPU, memory, connections and Windows space fail closed", () => {
  const changes = [
    (s) => {
      s.postgresCpuCorePercent = NaN;
    },
    (s) => {
      s.process.workingSetBytes = undefined;
    },
    (s) => {
      s.activity.connections = undefined;
    },
    (s) => {
      s.storage.windowsFreeBytes = undefined;
    },
    (s) => {
      s.storage.postgresDirectoryBytes = 5 * GIB;
    },
  ];
  for (const change of changes) {
    const current = measurement();
    change(current);
    assert.throws(() => evaluate(current, null, {}));
  }
});

test("connection count and lock duration limits are enforced", () => {
  const current = measurement();
  current.activity.connections = 21;
  assert.throws(() => evaluate(current, null, {}), /connection/);
  current.activity.connections = 20;
  current.activity.maxLockSeconds = 10.1;
  assert.throws(() => evaluate(current, null, {}), /lock/);
});

test("CPU deltas are normalized and sustained CPU triggers interruption", () => {
  const cpu = evaluate(measurement(1), measurement(), {});
  assert.ok(Math.abs(cpu.hostCpuPercent - 20) < 1e-10);
  assert.equal(cpu.apiCpuCorePercent, 5);
  assert.equal(cpu.highCpuDurationMs, 0);
  const state = {};
  let previous = measurement();
  for (let index = 1; index <= 3; index += 1) {
    const current = measurement(index);
    current.clock.idle = previous.clock.idle + 500;
    if (index < 3) {
      evaluate(current, previous, state);
    } else {
      assert.throws(() => evaluate(current, previous, state), /Sustained/);
    }
    previous = current;
  }
  const broken = measurement(1);
  broken.clock.idle = measurement().clock.idle - 1;
  assert.throws(() => evaluate(broken, measurement(), {}), /clocks/);
});

test("Docker memory units are parsed explicitly", () => {
  assert.equal(memoryBytes("1.5 GiB"), 1.5 * GIB);
  assert.equal(memoryBytes("42.5MiB"), 42.5 * 1024 ** 2);
  assert.equal(memoryBytes("900kB"), 900000);
  assert.throws(() => memoryBytes("N/A"));
});

test("aggregation stays bounded and does not retain SQL, tokens or response bodies", () => {
  const result = aggregate();
  for (let index = 0; index < 100; index += 1) {
    const current = measurement(index);
    current.slow = [{ fingerprint: `hash-${index}`, seconds: 2 }];
    accumulate(result, current, { hostCpuPercent: 20, apiCpuCorePercent: 5 });
  }
  assert.equal(result.samples, 100);
  assert.equal(result.slowObservations, 100);
  assert.equal(result.slowFingerprints.length, 20);
  assert.ok(JSON.stringify(result).length < 4000);
  assert.ok(!JSON.stringify(result).includes("cookie"));
});

test("supervisor observes a finite successful process and collects a final sample", async () => {
  const process = child();
  let index = 0;
  const observed = watch(
    process,
    measurement(),
    async () => measurement(++index),
    1,
  );
  setImmediate(() => process.emit("exit", 0));
  const result = await observed;
  assert.ok(result.samples >= 2);
  assert.equal(process.signals.length, 0);
});

test("sampling failure interrupts only the supervised child", async () => {
  const process = child();
  await assert.rejects(
    watch(
      process,
      measurement(),
      async () => {
        throw new Error("measurement lost");
      },
      1,
    ),
    /measurement lost/,
  );
  assert.deepEqual(process.signals, ["SIGINT"]);
});

test("memory watchdog interrupts even while the heavy collector is pending", async () => {
  const process = child();
  let samples = 0;
  await assert.rejects(
    supervisedWatch(
      process,
      measurement(),
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return measurement(1);
      },
      1,
      () => (++samples < 3 ? 1.5 * GIB : GIB - 1),
      {
        ...require("../load/plan.json").stopPolicy,
        ...require("../load/plan.json").readSmokeMemory,
      },
    ),
    /memory below 1073741824/,
  );
  assert.deepEqual(process.signals, ["SIGINT"]);
  assert.ok(samples >= 3);
});

test("low memory and nonzero k6 exit are never converted to success", async () => {
  const process = child();
  const low = measurement();
  low.freeMemoryBytes = GIB - 1;
  await assert.rejects(
    watch(process, low, async () => measurement(1), 1),
    /memory/,
  );
  assert.deepEqual(process.signals, ["SIGINT"]);
  const failed = child();
  let index = 0;
  const observed = watch(
    failed,
    measurement(),
    async () => measurement(++index),
    1,
  );
  setImmediate(() => failed.emit("exit", 99));
  await assert.rejects(observed, /exit code 99/);
});

test("read selections isolate filters, pages, sellers and one dashboard endpoint", () => {
  const manifest = {
    products: [{ id: "p1", sellerId: "s1", category: "OFFICE" }],
  };
  const first = requests(manifest, "catalog", "filtered1");
  const second = requests(manifest, "catalog", "filtered2");
  assert.ok(first[0].path.includes("page=1"));
  assert.ok(second[0].path.includes("page=2"));
  assert.ok(first[0].path.includes("sellerId=s1&category=OFFICE&inStock=true"));
  const high = requests(
    manifest,
    "dashboard",
    "high",
    "/dashboard/seller/summary",
  );
  const low = requests(
    manifest,
    "dashboard",
    "low",
    "/dashboard/seller/summary",
  );
  assert.equal(high.length, 1);
  assert.equal(high[0].sellerIndex, 0);
  assert.equal(low[0].sellerIndex, 1);
  assert.notEqual(high[0].tag, low[0].tag);
  assert.throws(() => requests(manifest, "dashboard", "mixed", "/users"));
  assert.throws(() => requests(manifest, "payment", "all"));
});

test("SQL oracles use read-only transactions without calling the API", async () => {
  let statements = 0;
  const db = {
    async $transaction(operation) {
      return operation({
        async $executeRaw(strings) {
          assert.ok(strings[0].includes("READ ONLY"));
        },
        async $queryRaw(sql) {
          statements += 1;
          assert.ok(!/DELETE|UPDATE|INSERT|TRUNCATE/.test(sql.sql));
          return statements === 1
            ? [{ id: "p1", priceInCents: 100 }]
            : [{ total: 1 }];
        },
      });
    },
  };
  const result = await prepareOracle(db, {}, [
    { path: "/products?page=1&limit=20", tag: "all" },
  ]);
  assert.equal(statements, 2);
  assert.equal(result[0].expected.pagination.total, 1);
});

test("history fingerprint includes every table and detects a changed record", async () => {
  const fake = (changed) => ({
    async $transaction(operation, options) {
      assert.equal(options.isolationLevel, "RepeatableRead");
      return operation({
        async $executeRaw() {},
        async $queryRaw(sql) {
          assert.ok(sql.sql.includes("ORDER BY id ASC LIMIT 500"));
          return [{ id: "1", data: { id: "1", value: changed ? 2 : 1 } }];
        },
      });
    },
  });
  const first = await fingerprint(fake(false));
  const again = await fingerprint(fake(false));
  const changed = await fingerprint(fake(true));
  assert.equal(Object.keys(first).length, TABLES.length);
  assert.deepEqual(first, again);
  assert.notEqual(first.user.sha256, changed.user.sha256);
});

test("SQL oracle comparison checks all expected values and deterministic array order", async () => {
  const { containsExpected } = await import("../load/rules.mjs");
  assert.equal(
    containsExpected(
      { data: [{ id: "1", priceInCents: 100, image: null }] },
      { data: [{ id: "1", priceInCents: 100 }] },
    ),
    true,
  );
  assert.equal(
    containsExpected({ data: [{ id: "2" }] }, { data: [{ id: "1" }] }),
    false,
  );
  assert.equal(containsExpected({ data: [] }, { data: [{ id: "1" }] }), false);
  assert.equal(containsExpected({ total: 2 }, { total: 1 }), false);
});

test("installed k6 parses the script with inspect without executing HTTP", (context) => {
  const load = path.resolve(__dirname, "../load");
  const binary = path.join(load, ".local/tools/k6-v1.3.0-windows-amd64/k6.exe");
  if (!fs.existsSync(binary)) {
    context.skip("Optional local k6 runtime is not installed");
    return;
  }
  const directory = fs.mkdtempSync(path.join(load, ".local/inspect-"));
  try {
    for (const file of ["read.k6.js", "rules.mjs", "plan.json"]) {
      fs.copyFileSync(path.join(load, file), path.join(directory, file));
    }
    fs.mkdirSync(path.join(directory, ".local"));
    fs.writeFileSync(
      path.join(directory, ".local/read-oracle.json"),
      JSON.stringify([
        {
          path: "/products?page=1&limit=20",
          tag: "static-inspect",
          expected: { data: [] },
        },
      ]),
    );
    fs.writeFileSync(
      path.join(directory, ".local/read-manifest.json"),
      JSON.stringify({
        apiUrl: "http://127.0.0.1:8051",
        database: "marketplace_scale",
        profile: "small",
        runId: "static-inspect-only",
        createdAt: new Date().toISOString(),
        products: Array.from({ length: 5 }, (_, i) => ({
          id: `unit-${i}`,
          sellerId: "unit",
          category: "OFFICE",
        })),
        sellers: [
          { id: "unit-1", cookie: "token=not-a-session" },
          { id: "unit-2", cookie: "token=not-a-session" },
        ],
      }),
    );
    const result = spawnSync(
      binary,
      [
        "inspect",
        "--env",
        "AUTHORIZE_READ=marketplace_scale-small",
        "--env",
        "SUPERVISED_READ=verified-local-run",
        path.join(directory, "read.k6.js"),
      ],
      {
        cwd: directory,
        encoding: "utf8",
        timeout: 15000,
        windowsHide: true,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).scenarios.bounded.iterations, 5);
    const rejected = spawnSync(
      binary,
      ["inspect", path.join(directory, "read.k6.js")],
      {
        cwd: directory,
        encoding: "utf8",
        timeout: 15000,
        windowsHide: true,
        env: { ...process.env, AUTHORIZE_READ: "", SUPERVISED_READ: "" },
      },
    );
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /supervised/);
  } finally {
    assert.ok(directory.startsWith(path.join(load, ".local") + path.sep));
    assert.ok(path.basename(directory).startsWith("inspect-"));
    fs.rmSync(directory, { recursive: true });
  }
});
