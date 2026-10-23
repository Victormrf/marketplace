const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const plan = require("../load/plan.json");
const { assertBaseline } = require("../load/control");
const { config } = require("../scripts/scale/planner");
const BACKEND = path.resolve(__dirname, "..");
const rules = import("../load/rules.mjs");

function manifest() {
  return {
    apiUrl: plan.apiUrl,
    database: "marketplace_scale",
    profile: "small",
    runId: "unit-test-no-database",
    createdAt: new Date().toISOString(),
    products: Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      sellerId: "s0",
      category: "OFFICE",
    })),
    sellers: [
      { id: "s0", cookie: "token=unit-test-only" },
      { id: "s1", cookie: "token=unit-test-only" },
    ],
  };
}

test("seven scenarios have finite HTTP budgets and conservative stages", () => {
  assert.deepEqual(Object.keys(plan.scenarios), [
    "catalog",
    "product",
    "cart",
    "checkout",
    "idempotency",
    "payment",
    "dashboard",
  ]);
  assert.equal(plan.fixtures.writesEnabled, false);
  assert.equal(plan.http.automaticRetries, 0);
  assert.equal(plan.tool.version, "1.3.0");
  for (const stages of [plan.stages, plan.writeStages]) {
    let previous = 0;
    for (const limits of Object.values(stages)) {
      assert.ok(
        Number.isInteger(limits.vus) && limits.vus >= 1 && limits.vus <= 5,
      );
      assert.ok(limits.operations > previous && limits.operations <= 100);
      assert.ok(
        limits.maxDurationSeconds >= 30 && limits.maxDurationSeconds <= 180,
      );
      previous = limits.operations;
    }
  }
  assert.equal(
    plan.scenarios.dashboard.requestsPerOperation,
    plan.scenarios.dashboard.paths.length,
  );
  assert.equal(plan.stopPolicy.minimumAvailableMemoryBytes, 2 * 1024 ** 3);
});

test("all write scenarios are blocked and read operation caps include dashboard fan-out", async () => {
  const { selectRun } = await rules;
  for (const [name, scenario] of Object.entries(plan.scenarios)) {
    for (const stage of Object.keys(plan.stages)) {
      if (scenario.mode === "write") {
        assert.throws(() => selectRun(plan, name, stage), /blocked/);
      } else {
        const selected = selectRun(plan, name, stage);
        assert.equal(
          selected.maxRequests,
          selected.operations * scenario.requestsPerOperation,
        );
      }
    }
  }
  assert.throws(() => selectRun(plan, "unknown", "smoke"));
  assert.throws(() => selectRun(plan, "catalog", "unlimited"));
});

test("409 classification requires the exact business reason, not just a status", async () => {
  const { classifyResult } = await rules;
  assert.equal(
    classifyResult(plan, "checkout", 409, {
      error: "Cart stock is insufficient",
    }),
    "expected_conflict",
  );
  assert.equal(
    classifyResult(plan, "idempotency", 409, {
      error: "Idempotency key is processing",
    }),
    "expected_conflict",
  );
  assert.equal(
    classifyResult(plan, "payment", 409, {
      error: "Order already has an active or captured payment attempt",
    }),
    "expected_conflict",
  );
  for (const [status, body] of [
    [409, { error: "Other conflict" }],
    [409, null],
    [401, {}],
    [403, {}],
    [500, {}],
    [0, {}],
  ]) {
    assert.equal(classifyResult(plan, "checkout", status, body), "unexpected");
  }
  assert.equal(
    classifyResult(plan, "catalog", 409, {
      error: "Cart stock is insufficient",
    }),
    "unexpected",
  );
});

test("manifest guard rejects remote targets, expiry, missing sessions and wrong datasets", async () => {
  const { assertManifest, assertApiUrl } = await rules;
  const sample = manifest();
  assert.doesNotThrow(() => assertManifest(sample));
  for (const target of [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://example.invalid",
    `${plan.apiUrl}/other`,
  ]) {
    assert.throws(() => assertApiUrl(target));
  }
  assert.throws(() =>
    assertManifest({ ...sample, database: "marketplace_dev" }),
  );
  assert.throws(() => assertManifest({ ...sample, sellers: [] }));
  assert.throws(() => assertManifest({ ...sample, profile: "large" }));
  assert.throws(() =>
    assertManifest(sample, Date.parse(sample.createdAt) + 46 * 60000),
  );
});

test("API preparation requires completed small baseline and never authorizes another load", () => {
  const valid = {
    state: "completed",
    report: {
      profile: "small",
      insertedTotal: config.profiles.small.totalRows,
    },
  };
  assert.doesNotThrow(() => assertBaseline(valid));
  for (const state of ["ready", "loading", "interrupted"]) {
    assert.throws(() => assertBaseline({ ...valid, state }));
  }
  assert.throws(() =>
    assertBaseline({
      state: "completed",
      report: { profile: "medium", insertedTotal: 30349 },
    }),
  );
  const source = fs.readFileSync(path.join(BACKEND, "load/control.js"), "utf8");
  assert.match(source, /SET TRANSACTION READ ONLY/);
  assert.match(source, /PORT: "8051"/);
  assert.match(source, /dist\/server\.js/);
  assert.doesNotMatch(
    source,
    /\.deleteMany\(|\.createMany\(|TRUNCATE|database\.purge\(|database\.consume\(/,
  );
});

test("business conflict strings and request routes exist in the current backend", () => {
  const sources = [
    "repositories/checkoutRepository.ts",
    "repositories/paymentAttemptRepository.ts",
  ]
    .map((name) => fs.readFileSync(path.join(BACKEND, "src", name), "utf8"))
    .join("\n");
  for (const scenario of Object.values(plan.scenarios)) {
    for (const reason of scenario.expectedConflicts || []) {
      assert.ok(
        sources.includes(reason) ||
          (reason === "Idempotency key is processing" &&
            sources.includes(
              "Idempotency key is ${existing.status.toLowerCase()}",
            )),
      );
    }
  }
  const dashboard = fs.readFileSync(
    path.join(BACKEND, "src/controllers/dashboardController.ts"),
    "utf8",
  );
  for (const request of plan.scenarios.dashboard.paths) {
    assert.ok(
      dashboard.includes(`"${request.slice("GET /dashboard".length)}"`),
    );
  }
});

test("k6 module has valid JavaScript syntax without running imports or HTTP", () => {
  const source = fs.readFileSync(path.join(BACKEND, "load/read.k6.js"), "utf8");
  const checked = spawnSync(
    process.execPath,
    ["--input-type=module", "--check"],
    { input: source, encoding: "utf8", windowsHide: true },
  );
  assert.equal(checked.status, 0, checked.stderr);
});

test("script operations use only bounded GETs with normalized tags and no login in the measured loop", async () => {
  const imported = await rules;
  const source = fs
    .readFileSync(path.join(BACKEND, "load/read.k6.js"), "utf8")
    .replace(/import[\s\S]*?from\s+"[^"]+";/g, "")
    .replace("export const options", "const options")
    .replace("export default function", "function run");
  for (const scenario of ["catalog", "product", "dashboard"]) {
    const calls = [];
    const sample = manifest();
    const metric = class {
      add() {}
    };
    const context = vm.createContext({
      ...imported,
      __ENV: { SCENARIO: scenario, AUTHORIZE_READ: "marketplace_scale-small" },
      open: (file) => JSON.stringify(file === "./plan.json" ? plan : sample),
      Counter: metric,
      Rate: metric,
      sleep: () => {},
      check: (value) => assert.equal(value, true),
      exec: {
        scenario: { iterationInTest: 0 },
        test: { abort: (reason) => assert.fail(reason) },
      },
      http: {
        get(url, params) {
          calls.push({ url, params });
          const body = url.includes("/products/p")
            ? { id: "p0", priceInCents: 100, currency: "BRL" }
            : url.includes("/summary")
              ? { grossRevenueInCents: 0, currency: "BRL" }
              : url.includes("/ratings")
                ? { totalReviews: 0, distribution: {} }
                : url.includes("/products?") || url.includes("/orders?")
                  ? { data: [], pagination: { total: 0 } }
                  : [];
          return { status: 200, json: () => body };
        },
      },
    });
    vm.runInContext(`${source}\nrun();`, context);
    assert.equal(calls.length, plan.scenarios[scenario].requestsPerOperation);
    for (const call of calls) {
      assert.ok(call.url.startsWith(plan.apiUrl));
      assert.equal(call.params.timeout, "10s");
      assert.equal(call.params.redirects, 0);
      assert.ok(!call.params.tags.name.includes("p0"));
    }
  }
});
