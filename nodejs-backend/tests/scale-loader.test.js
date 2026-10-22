const assert = require("node:assert/strict");
const test = require("node:test");
const {
  DEFAULT_URL,
  TARGET,
  assertTarget,
  assertConfirmation,
  assertProfileApproval,
  assertBudget,
} = require("../scripts/scale/environment");
const { config, buildPlan, logistics } = require("../scripts/scale/planner");
const {
  TABLES,
  rows,
  auditPlan,
  checkoutDto,
} = require("../scripts/scale/records");
const { assertReady, exclusive } = require("../scripts/scale/database");
const { BATCH_SIZE, batches, parseArguments } = require("../scripts/scale/cli");

test("destination guards reject dev, E2E, remote, wrong identity and extra URL parameters", () => {
  assert.equal(assertTarget(DEFAULT_URL), DEFAULT_URL);

  for (const url of [
    DEFAULT_URL.replace("5435", "5433"),
    DEFAULT_URL.replace("5435", "5434"),
    DEFAULT_URL.replace("127.0.0.1", "remote.invalid"),
    DEFAULT_URL.replace("/marketplace_scale", "/marketplace_dev"),
    DEFAULT_URL.replace("//marketplace_scale:", "//postgres:"),
    `${DEFAULT_URL}?schema=public`,
  ]) {
    assert.throws(() => assertTarget(url));
  }

  assert.throws(() => assertConfirmation(undefined));
  assert.doesNotThrow(() => assertConfirmation(TARGET.confirmation));
});

test("non-small profiles are rejected before generation without manual approval", () => {
  assert.throws(() => assertProfileApproval("medium", undefined, false));
  assert.throws(() => assertProfileApproval("large", undefined, true));
  assert.throws(() => buildPlan("medium"));
  assert.throws(() => buildPlan("large"));
  assert.throws(() =>
    parseArguments(["load", "--arbitrary-url", "remote.invalid"]),
  );
});

test("a consumed, interrupted or nonempty state cannot authorize another load", () => {
  assert.doesNotThrow(() => assertReady({ state: "ready" }, { user: 0 }));

  for (const state of ["loading", "completed", "interrupted"]) {
    assert.throws(() => assertReady({ state }, { user: 0 }));
  }

  assert.throws(() => assertReady({ state: "ready" }, { user: 1 }));
});

test("load and purge use the same exclusive PostgreSQL lock contract", async () => {
  let locked = false;
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const db = {
    async $transaction(operation) {
      let owns = false;

      try {
        return await operation({
          async $queryRaw() {
            owns = !locked;
            if (owns) locked = true;
            return [{ acquired: owns }];
          },
        });
      } finally {
        if (owns) locked = false;
      }
    },
  };
  const loading = exclusive(db, async () => {
    entered();
    await held;
  });
  await ready;
  await assert.rejects(
    exclusive(db, async () => {}),
    /running/,
  );
  release();
  await loading;
  await assert.rejects(
    exclusive(db, async () => {
      throw new Error("injected failure");
    }),
    /injected failure/,
  );
  await exclusive(db, async () => {});
});

test("indispensable Windows measurements and preventive margins fail closed", () => {
  const measurement = {
    databaseBytes: 20 * 1024 ** 2,
    postgresDirectoryBytes: 60 * 1024 ** 2,
    walDirectoryBytes: 16 * 1024 ** 2,
    windowsFreeBytes: 20 * 1024 ** 3,
    writableLayerBytes: 1000,
    boundedLogBytes: 30 * 1024 ** 2,
  };
  const profile = config.profiles.small;
  const check = (value, count = 0, elapsed = 0) => {
    return assertBudget(
      value,
      config.executionPolicy,
      profile.limits,
      count,
      200,
      elapsed,
    );
  };

  assert.doesNotThrow(() => check(measurement));
  assert.throws(() => check({ ...measurement, windowsFreeBytes: undefined }));
  assert.throws(() => check({ ...measurement, windowsFreeBytes: 1024 }));
  assert.throws(() =>
    check({ ...measurement, postgresDirectoryBytes: 5 * 1024 ** 3 }),
  );
  assert.throws(() => check(measurement, profile.limits.maxRecords));
  assert.throws(() => check(measurement, 0, profile.limits.maxDurationMs));
});

test("small planning and lazy records are deterministic with exact physical table quotas", () => {
  const first = buildPlan("small");
  const audit = auditPlan(first);
  const second = auditPlan(buildPlan("small"));
  const expected = {
    user: 110,
    customer: 100,
    seller: 10,
    customer_address: 150,
    product: 500,
    inventory: 500,
    cart: 40,
    cart_item: 80,
    order: 1000,
    seller_order: 1400,
    order_item: 3500,
    order_address: 1000,
    payment_attempt: 1150,
    refund: 105,
    delivery: 784,
    order_status_history: 1700,
    seller_order_status_history: 4106,
    delivery_status_history: 3314,
    inventory_reservation: 3500,
    inventory_movement: 6000,
    review: 300,
    idempotency_key: 1000,
  };

  assert.deepEqual(audit.counts, expected);
  assert.equal(audit.total, 30349);
  assert.deepEqual(second, audit);

  for (const [model] of TABLES) {
    const identifiers = new Set();

    for (const batch of batches(rows(model, first))) {
      assert.ok(batch.length > 0 && batch.length <= BATCH_SIZE);

      for (const row of batch) {
        assert.ok(!identifiers.has(row.id));
        identifiers.add(row.id);
        assert.ok(!JSON.stringify(row).includes("Invalid Date"));
      }
    }
  }
});

test("planned ownership, stock, full payments, historical reviews and snapshots are coherent", () => {
  const plan = buildPlan("small");
  let popularLines = 0;

  for (const order of plan.orders) {
    const sellers = order.sellerOrders.map(
      (index) => plan.sellerOrders[index].seller,
    );
    assert.equal(new Set(sellers).size, sellers.length);
    assert.equal(
      order.total,
      order.sellerOrders.reduce((sum, index) => {
        return sum + plan.sellerOrders[index].total;
      }, 0),
    );
    assert.ok(
      order.attempts.filter((attempt) => attempt.status === "CAPTURED")
        .length <= 1,
    );
    const snapshot = checkoutDto(plan, order);
    assert.equal(snapshot.totalInCents, order.total);
    assert.equal(snapshot.status, "PENDING_PAYMENT");
  }

  for (const so of plan.sellerOrders) {
    const productIds = so.items.map((index) => plan.items[index].product);
    assert.equal(new Set(productIds).size, productIds.length);

    for (const index of so.items) {
      const item = plan.items[index];
      assert.equal(plan.products[item.product].seller, so.seller);
      assert.equal(item.total, item.quantity * item.price);
      if (plan.products[item.product].popular) popularLines += 1;
    }

    const times = logistics(plan, so);
    assert.ok(times.deliveryTimes.every((time) => Number.isFinite(time)));
  }

  assert.equal(popularLines, 2450);
  const reviewPairs = new Set();

  for (const review of plan.reviews) {
    const pair = `${review.customer}:${review.target}:${review.value}`;
    assert.ok(!reviewPairs.has(pair));
    reviewPairs.add(pair);
    assert.equal(plan.sellerOrders[review.sellerOrder].scenario, "delivered");
  }

  for (const product of plan.products) {
    assert.equal(product.onHand - product.reserved, product.available);
    assert.ok(product.onHand >= product.reserved);
  }
});
