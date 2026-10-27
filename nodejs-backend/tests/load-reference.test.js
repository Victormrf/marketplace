const test = require("node:test");
const assert = require("node:assert/strict");
const target = require("../load/fixture-db");
const fixtures = require("../load/fixture-manager");
const { execute, limitsFor } = require("../load/write-executor");
const { fingerprint } = require("../load/fingerprint");
const { requests } = require("../load/oracles");

test("minimal reads select one product and one endpoint with five serial requests", async () => {
  const plan = structuredClone(require("../load/plan.json"));
  plan.reducedBaseline.enabled = true;
  const rules = await import("../load/rules.mjs");
  const limits = rules.selectRun(plan, "dashboard", "reference");
  assert.equal(limits.maxRequests, 5);
  assert.equal(limits.vus, 1);
  assert.equal(limits.maxDurationSeconds, 60);
  assert.equal(
    requests(
      { products: [{ id: "first" }, { id: "second" }] },
      "product",
      "popular-one",
    ).length,
    1,
  );
  assert.throws(() =>
    rules.assertAuthorizedRead(
      plan,
      "dashboard",
      "low",
      "reference",
      "/dashboard/seller/summary",
    ),
  );
});

test("reference write policy is scoped to its two scenarios and has explicit memory thresholds", async () => {
  const db = target.client({ reference: true });
  const plan = require("../load/plan.json");
  const enabled = plan.reducedBaseline.enabled;
  plan.reducedBaseline.enabled = true;
  try {
    assert.equal(target.policy(db).minimumStartAvailableMemoryBytes, 0);
    assert.equal(target.policy(db).minimumAvailableMemoryBytes, 0);
    assert.throws(() => target.assertReference(db, "cart", 2, true));
    assert.throws(() => target.assertReference(db, "checkout-shared", 3, true));
    assert.doesNotThrow(() =>
      target.assertReference(db, "checkout-shared", 2, true),
    );
  } finally {
    plan.reducedBaseline.enabled = enabled;
    await db.$disconnect();
  }
});

test("reference plans have one stock unit, two calls and explicit approval", () => {
  const plan = require("../load/plan.json");
  const enabled = plan.reducedBaseline.enabled;
  plan.reducedBaseline.enabled = true;
  try {
    const manifest = fixtures.planFixture("checkout-shared", 2, true);
    assert.equal(manifest.products[0].onHand, 1);
    assert.equal(manifest.customers.length, 2);
    assert.equal(
      limitsFor(
        "reference",
        manifest,
        `${manifest.namespace}:checkout-shared:reference`,
        "scale",
      ).vus,
      2,
    );
    assert.throws(() => limitsFor("reference", manifest, "wrong", "scale"));
  } finally {
    plan.reducedBaseline.enabled = enabled;
  }
});

// Opt-in integration suite. It never connects to scale and never cleans up a failure.
if (process.env.TEST_REFERENCE_POSTGRES === "yes") {
  require("../load/plan.json").reducedBaseline.enabled = true; // Only this dedicated-test process.
  const db = target.client({ reference: true });
  let baseline;
  test.before(async () => {
    target.assertWrite(db);
    await target.identify(db);
    assert.ok(
      ["EMPTY", "RECOVERED"].includes((await fixtures.status(db)).state),
    );
    baseline = await fingerprint(db);
  });
  test.after(() => db.$disconnect());
  for (const scenario of ["checkout-shared", "idempotency"]) {
    test(`reference ${scenario} uses two coordinated HTTP requests and recovers explicitly`, async () => {
      await fixtures.prepare(db, scenario, 2);
      const report = await execute(db, { stage: "reference" });
      assert.equal(report.business.success, 1);
      assert.equal(report.http.dispatched, 2);
      assert.ok(report.http.peakInFlight >= 2);
      const observed = await fixtures.reconcile(db);
      assert.equal(observed.effects.order.length, 1);
      assert.equal(observed.effects.idempotencyKey.length, 1);
      assert.equal(observed.effects.inventoryReservation.length, 1);
      if (scenario === "checkout-shared") {
        assert.equal(report.business.expectedConflicts, 1);
      }
      await fixtures.recover(db, "API_AND_RUNNER_STOPPED");
      assert.deepEqual(await fingerprint(db), baseline);
    });
  }
  test("reference preparation failure preserves committed effects until explicit recovery", async () => {
    const cause = new Error("reference partial failure");
    await assert.rejects(
      fixtures.prepare(db, "checkout-shared", 2, {
        afterStage: (stage) => {
          if (stage === 1) {
            throw cause;
          }
        },
      }),
      (error) => error === cause,
    );
    assert.equal((await fixtures.reconcile(db)).state, "UNKNOWN");
    await fixtures.recover(db, "API_AND_RUNNER_STOPPED");
    assert.deepEqual(await fingerprint(db), baseline);
  });
}
