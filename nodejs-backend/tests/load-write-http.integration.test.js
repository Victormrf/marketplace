const test = require("node:test");
const assert = require("node:assert/strict");
const target = require("../load/fixture-db");
const fixtures = require("../load/fixture-manager");
const { execute } = require("../load/write-executor");
const { fingerprint } = require("../load/fingerprint");
const db = target.client();
let baseline;

test.before(async () => {
  target.assertWrite(db);
  await target.identify(db);
  assert.ok(
    ["EMPTY", "RECOVERED"].includes((await fixtures.status(db)).state),
    "Previous experiment requires explicit reconciliation/recovery",
  );
  baseline = await fingerprint(db);
});
test.after(() => db.$disconnect()); // Never automatically removes a failed experiment.

for (const scenario of [
  "cart",
  "checkout-shared",
  "checkout-distinct",
  "idempotency",
  "payment",
]) {
  test(`real HTTP ${scenario} authenticates fixture customers and explicitly recovers every effect`, async () => {
    const coordinated = ["checkout-shared", "idempotency"].includes(scenario);
    const operations = coordinated ? 10 : 2;
    const stage = coordinated ? "low" : "smoke";
    const manifest = await fixtures.prepare(db, scenario, operations);
    const report = await execute(db, { stage });
    assert.equal(report.result, "completed-awaiting-explicit-recovery");
    assert.equal(report.business.operations, operations);
    assert.ok(report.http.responses >= 2);
    if (coordinated) {
      assert.ok(report.http.peakInFlight >= 2);
    }
    assert.ok(report.resources.minHostFreeBytes >= 2 * 1024 ** 3);
    await assert.rejects(execute(db, { stage }), /no repeat/);
    const found = await fixtures.reconcile(db);
    if (scenario === "idempotency") {
      assert.equal(found.effects.order.length, 1);
    }
    if (scenario === "checkout-shared") {
      assert.equal(report.business.success, 2);
      assert.equal(report.business.expectedConflicts, 8);
    }
    if (scenario === "payment") {
      assert.equal(found.effects.paymentAttempt.length, 1);
    }
    const recovered = await fixtures.recover(db, "API_AND_RUNNER_STOPPED");
    assert.equal(recovered.baselineIntact, true);
    assert.deepEqual(await fingerprint(db), baseline);
    assert.equal(
      await db.user.count({
        where: { id: { startsWith: manifest.namespace } },
      }),
      0,
    );
  });
}

test("a real checkout with a lost response is reconciled and explicitly recovered without replay", async () => {
  await fixtures.prepare(db, "idempotency", 2);
  let committedId;
  let dispatched = 0;
  await assert.rejects(
    execute(db, {
      stage: "smoke",
      hooks: {
        fetcher: async (url, options) => {
          dispatched += 1;
          const response = await fetch(url, options);
          if (response.status === 201) {
            committedId = (await response.clone().json()).id;
            throw new Error(
              "injected lost delivery after real checkout commit",
            );
          }
          return response;
        },
      },
    }),
    /lost delivery|k6 stopped/,
  );
  assert.equal(dispatched, 1);
  const found = await fixtures.reconcile(db);
  assert.equal(found.state, "UNKNOWN");
  assert.deepEqual(found.effects.order, [committedId]);
  await assert.rejects(fixtures.prepare(db, "cart", 2), /not reconciled/);
  await fixtures.recover(db, "API_AND_RUNNER_STOPPED");
  assert.deepEqual(await fingerprint(db), baseline);
});
