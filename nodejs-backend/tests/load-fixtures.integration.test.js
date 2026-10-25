const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const target = require("../load/fixture-db");
const fixtures = require("../load/fixture-manager");
const { fingerprint } = require("../load/fingerprint");
const { assertMemory } = require("../load/supervisor");

const db = target.client();
const ACK = "API_AND_RUNNER_STOPPED";
const historicalId = "load-fixture-test-historical-user";
let original;

test.before(async () => {
  assertMemory();
  await target.identify(db);
  const control = await fixtures.status(db);
  assert.ok(
    ["EMPTY", "RECOVERED"].includes(control.state),
    "Unresolved fixture preserved; inspect/recover explicitly before re-running tests",
  );
  if (!(await db.user.findUnique({ where: { id: historicalId } }))) {
    await db.user.create({
      data: {
        id: historicalId,
        name: "Historical fixture sentinel",
        email: "load-fixture-history@local.invalid",
        normalizedEmail: "load-fixture-history@local.invalid",
        password: "not-used-for-authentication",
        role: "CUSTOMER",
      },
    });
  }
  original = await fingerprint(db);
});
test.after(async () => {
  await db.$disconnect();
}); // No automatic recovery/reset on failures.

for (const scenario of [
  "cart",
  "checkout-shared",
  "checkout-distinct",
  "idempotency",
  "payment",
]) {
  test(`prepare and explicitly recover ${scenario} without changing historical rows`, async () => {
    const plan = await fixtures.prepare(db, scenario, 2);
    assert.ok(plan.customers.length <= 20 && plan.products.length <= 21);
    assert.equal((await fixtures.status(db)).state, "READY");
    await assert.rejects(fixtures.prepare(db, scenario, 2), /not reconciled/);
    const found = await fixtures.reconcile(db);
    assert.equal(found.effects.seller.length, 1);
    assert.equal(found.effects.customerProfile.length, plan.participants);
    const recovered = await fixtures.recover(db, ACK);
    assert.equal(recovered.baselineIntact, true);
    assert.deepEqual(await fingerprint(db), original);
  });
}

test("a failure after a committed preparation stage stays UNKNOWN until explicit recovery", async () => {
  const cause = new Error("injected after committed users");
  await assert.rejects(
    fixtures.prepare(db, "cart", 2, {
      afterStage: (stage) => {
        if (stage === 1) {
          throw cause;
        }
      },
    }),
    (error) => error === cause,
  );
  assert.equal((await fixtures.status(db)).state, "UNKNOWN");
  assert.ok((await fixtures.reconcile(db)).effects.user.length > 0);
  await assert.rejects(fixtures.prepare(db, "cart", 2), /not reconciled/);
  await fixtures.recover(db, ACK);
  assert.deepEqual(await fingerprint(db), original);
});

test("preparation and recovery cannot run concurrently", async () => {
  let entered;
  let release;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  const preparing = fixtures.prepare(db, "cart", 1, {
    afterStage: async (stage) => {
      if (stage === 1) {
        entered();
        await barrier;
      }
    },
  });
  const second = target.client();
  try {
    await ready;
    await assert.rejects(
      fixtures.prepare(second, "cart", 1),
      /Another fixture/,
    );
    await assert.rejects(fixtures.recover(second, ACK), /Another fixture/);
  } finally {
    release();
    await second.$disconnect();
  }
  await preparing;
  await fixtures.recover(db, ACK);
  assert.deepEqual(await fingerprint(db), original);
});

test("recovery failure rolls back every deletion and preserves the manifest", async () => {
  await fixtures.prepare(db, "payment", 2);
  const before = await fingerprint(db);
  await assert.rejects(
    fixtures.recover(db, ACK, {
      afterDelete: () => {
        throw new Error("injected recovery rollback");
      },
    }),
    /injected recovery/,
  );
  assert.equal((await fixtures.status(db)).state, "READY");
  assert.deepEqual(await fingerprint(db), before);
  await fixtures.recover(db, ACK);
  assert.deepEqual(await fingerprint(db), original);
});

test("an orphaned RUNNING manifest blocks preparation and requires explicit recovery", async () => {
  await fixtures.prepare(db, "cart", 1);
  // Represents persisted state after a runner exits without releasing its result.
  await db.$executeRaw`UPDATE scale_ops.load_experiments SET state='RUNNING' WHERE singleton=true`;
  assert.equal((await fixtures.reconcile(db)).state, "RUNNING");
  await assert.rejects(fixtures.prepare(db, "cart", 1), /not reconciled/);
  await assert.rejects(
    fixtures.runTest(db, async () => {}),
    /not ready/,
  );
  await fixtures.recover(db, ACK);
  assert.deepEqual(await fingerprint(db), original);
});

test("committed effect with lost response is discovered without another payment or round", async () => {
  const plan = await fixtures.prepare(db, "payment", 1);
  const customer = plan.customers[0];
  const id = randomUUID();
  await assert.rejects(
    fixtures.runTest(db, async () => {
      await db.paymentAttempt.create({
        data: {
          id,
          orderId: customer.orderId,
          provider: "DEV_SIMULATOR",
          providerReference: `dev_${id}`,
          method: "PIX",
          amountInCents: plan.products[0].priceInCents,
          currency: "BRL",
        },
      });
      throw new Error("response lost after commit");
    }),
    /response lost/,
  );
  const observed = await fixtures.reconcile(db);
  assert.equal(observed.state, "UNKNOWN");
  assert.deepEqual(observed.effects.paymentAttempt, [id]);
  await assert.rejects(
    fixtures.runTest(db, async () => {}),
    /not ready/,
  );
  await fixtures.recover(db, ACK);
  assert.deepEqual(await fingerprint(db), original);
});

test("cross-namespace foreign keys block recovery without deleting anything", async () => {
  const plan = await fixtures.prepare(db, "cart", 1);
  const reference = await db.review.create({
    data: { userId: historicalId, productId: plan.products[0].id, rating: 4 },
  });
  const before = await fingerprint(db);
  await assert.rejects(
    fixtures.recover(db, ACK),
    /unexpected refund\/delivery\/review/,
  );
  assert.deepEqual(await fingerprint(db), before);
  // This deliberately-created negative-test row is explicitly removed by its exact ID.
  await db.review.delete({ where: { id: reference.id } });
  await fixtures.recover(db, ACK);
  assert.deepEqual(await fingerprint(db), original);
});

test("historical signature mismatch refuses recovery before any delete", async () => {
  await fixtures.prepare(db, "cart", 1);
  const before = await db.user.findUnique({ where: { id: historicalId } });
  await db.user.update({
    where: { id: historicalId },
    data: { name: "negative-test changed sentinel" },
  });
  await assert.rejects(fixtures.recover(db, ACK), /Historical rows changed/);
  assert.ok((await fixtures.reconcile(db)).effects.user.length > 0);
  await db.user.update({
    where: { id: historicalId },
    data: { name: before.name, updatedAt: before.updatedAt },
  });
  await fixtures.recover(db, ACK);
  assert.deepEqual(await fingerprint(db), original);
});
