const test = require("node:test");
const assert = require("node:assert/strict");
const { setImmediate: nextTick } = require("node:timers/promises");
const { planFixture, validateManifest } = require("../load/fixture-manager");
const { URL, assertTestTarget } = require("../load/fixture-db");
const scripts = require("../load/write-scenarios");

function simulated(manifest) {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const snapshots = new Map();
  const state = {
    cartItems: [],
    inventories: manifest.products.map((p) => ({
      id: p.inventoryId,
      productId: p.id,
      onHandQuantity: p.onHand,
      reservedQuantity: manifest.scenario === "payment" ? 1 : 0,
    })),
    orders:
      manifest.scenario === "payment"
        ? manifest.customers.map((c) => ({
            id: c.orderId,
            customerId: c.id,
            totalInCents: manifest.products.find((p) => p.id === c.productId)
              .priceInCents,
            status: "PENDING_PAYMENT",
          }))
        : [],
    attempts: [],
    reservations: [],
    keys: [],
  };
  const transport = async (request) => {
    calls.push(request);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await nextTick();
    active -= 1;
    const customer = manifest.customers.find(
      (c) => c.id === request.customerId,
    );
    const product = manifest.products.find((p) => p.id === customer.productId);
    const inventory = state.inventories.find((r) => r.productId === product.id);
    if (request.path.startsWith("/cart/items")) {
      let item = state.cartItems.find((r) => r.customerId === customer.id);
      if (!item) {
        item = { customerId: customer.id, productId: product.id };
        state.cartItems.push(item);
      }
      item.quantity = request.body.quantity;
      item.lineTotalInCents = product.priceInCents * item.quantity;
      item.hasSufficientStock = true;
      return {
        status: request.method === "POST" ? 201 : 200,
        body: { items: [{ ...item }], totalInCents: item.lineTotalInCents },
      };
    }
    if (request.path === "/checkout") {
      const key = request.headers["Idempotency-Key"];
      if (snapshots.has(key)) {
        return {
          status: 200,
          headers: { "Idempotency-Replayed": "true" },
          body: snapshots.get(key),
        };
      }
      if (inventory.reservedQuantity >= inventory.onHandQuantity) {
        return { status: 409, body: { error: "Cart stock is insufficient" } };
      }
      const id = `order-${state.orders.length}`;
      const order = {
        id,
        customerId: customer.id,
        status: "PENDING_PAYMENT",
        totalInCents: product.priceInCents,
        currency: "BRL",
        address: { sourceAddressId: customer.addressId },
        sellerOrders: [
          {
            sellerId: manifest.seller.id,
            items: [
              {
                productId: product.id,
                quantity: 1,
                lineTotalInCents: product.priceInCents,
              },
            ],
          },
        ],
      };
      state.orders.push(order);
      state.keys.push({ key, orderId: id, status: "COMPLETED" });
      state.reservations.push({ orderId: id, quantity: 1 });
      inventory.reservedQuantity += 1;
      snapshots.set(key, order);
      return { status: 201, body: order };
    }
    if (request.path === `/orders/${customer.orderId}/payment-attempts`) {
      if (state.attempts.some((a) => a.orderId === customer.orderId)) {
        return {
          status: 409,
          body: {
            error: "Order already has an active or captured payment attempt",
          },
        };
      }
      const attempt = {
        id: `attempt-${state.attempts.length}`,
        orderId: customer.orderId,
        method: "PIX",
        status: "CREATED",
        provider: "DEV_SIMULATOR",
        providerReference: `dev_${customer.orderId}`,
        amountInCents: product.priceInCents,
        currency: "BRL",
      };
      state.attempts.push(attempt);
      return { status: 201, body: attempt };
    }
    throw new Error("Unexpected simulated endpoint");
  };
  return {
    calls,
    state,
    transport,
    inspect: async () => state,
    maxActive: () => maxActive,
  };
}

async function execute(scenario, options = {}) {
  const manifest = planFixture(scenario, 4);
  const fake = simulated(manifest);
  const result = await scripts.run({
    manifest,
    operations: 4,
    concurrency: 2,
    mode: "simulation",
    destination: "simulation",
    transport: fake.transport,
    inspect: fake.inspect,
    ...options,
  });
  return { manifest, fake, result };
}

test("fixture destination rejects scale, dev, E2E, remote and wrong database/user before connection", () => {
  assert.equal(assertTestTarget(URL), URL);
  for (const candidate of [
    URL.replace("5436", "5435"),
    URL.replace("marketplace_load_test", "marketplace_scale"),
    URL.replace("127.0.0.1", "remote.invalid"),
    URL.replace("5436", "5433"),
    URL.replace("5436", "5434"),
    `${URL}?schema=public`,
  ]) {
    assert.throws(() => assertTestTarget(candidate), /Refusing/);
  }
  assert.throws(() =>
    scripts.assertMode("fixture-test", "http://127.0.0.1:8051"),
  );
  assert.throws(() => scripts.assertMode("scale", "http://127.0.0.1:8051"));
});

test("fixture namespace is unique, bounded and cannot reference historical IDs", () => {
  const first = planFixture("cart", 20);
  validateManifest(first);
  assert.equal(first.customers.length, 20);
  assert.ok(first.products.length <= 21);
  assert.notEqual(first.namespace, planFixture("cart", 20).namespace);
  assert.throws(() => planFixture("cart", 21));
  assert.throws(() => planFixture("unknown", 1));
  first.customers[0].productId = "historical-product";
  assert.throws(() => validateManifest(first), /ownership/);
});

test("cart script checks add/update bodies, quantities and persisted stock", async () => {
  const { fake, result } = await execute("cart");
  assert.equal(result.success, 4);
  assert.equal(result.requests, 8);
  assert.ok(fake.maxActive() >= 2);
  assert.deepEqual(Object.keys(fake.calls[0].body).sort(), [
    "productId",
    "quantity",
  ]);
  assert.deepEqual(Object.keys(fake.calls[1].headers), []);
});

test("shared stock creates only two orders and classifies exact 409 with persisted effects", async () => {
  const { result, fake } = await execute("checkout-shared");
  assert.equal(result.success, 2);
  assert.equal(result.expectedConflicts, 2);
  assert.equal(fake.state.reservations.length, 2);
  assert.equal(fake.state.inventories[0].reservedQuantity, 2);
  assert.ok(fake.maxActive() >= 2);
});

test("distinct products create one order per customer without conflicts", async () => {
  const { result, fake } = await execute("checkout-distinct");
  assert.equal(result.success, 4);
  assert.equal(result.expectedConflicts, 0);
  assert.equal(new Set(fake.state.orders.map((o) => o.customerId)).size, 4);
  assert.ok(
    fake.calls.every((r) => Object.keys(r.body).join() === "addressId"),
  );
});

test("idempotency coordinates same key/body and returns one persisted order", async () => {
  const { result, fake } = await execute("idempotency");
  assert.equal(result.success, 1);
  assert.equal(result.replays, 3);
  assert.equal(fake.state.orders.length, 1);
  assert.equal(
    new Set(fake.calls.map((r) => r.headers["Idempotency-Key"])).size,
    1,
  );
  assert.equal(new Set(fake.calls.map((r) => r.body.addressId)).size, 1);
  assert.ok(fake.maxActive() >= 2);
});

test("full payment creates one active attempt and blocks duplicate requests", async () => {
  const { result, fake } = await execute("payment");
  assert.equal(result.success, 1);
  assert.equal(result.expectedConflicts, 3);
  assert.equal(fake.state.attempts.length, 1);
  assert.ok(fake.calls.every((r) => Object.keys(r.body).join() === "method"));
  assert.ok(fake.state.orders.every((o) => o.status === "PENDING_PAYMENT"));
});

test("independent full payments do not become parcels or simulated capture", async () => {
  const { result, fake } = await execute("payment", {
    paymentVariant: "independent",
  });
  assert.equal(result.success, 4);
  assert.equal(fake.state.attempts.length, 4);
  assert.ok(fake.state.attempts.every((a) => a.status === "CREATED"));
});

test("a generic 409 is never accepted as stock conflict", async () => {
  const plan = planFixture("checkout-shared", 2);
  await assert.rejects(
    scripts.run({
      manifest: plan,
      operations: 2,
      mode: "simulation",
      destination: "simulation",
      transport: async () => ({
        status: 409,
        body: { error: "some other conflict" },
      }),
      inspect: async () => ({}),
    }),
    (error) =>
      error.writeSummary.result === "unknown-or-invalid" &&
      error.writeSummary.requests === 1,
  );
});

test("an expected reason without matching persisted effects still fails", async () => {
  const manifest = planFixture("checkout-shared", 4);
  const fake = simulated(manifest);
  await assert.rejects(
    scripts.run({
      manifest,
      operations: 4,
      concurrency: 2,
      mode: "simulation",
      destination: "simulation",
      transport: fake.transport,
      inspect: async () => ({ ...fake.state, reservations: [] }),
    }),
    (error) => error.writeSummary.result === "unknown-or-invalid",
  );
});

test("a lost response preserves the key and committed effect without retry or next batch", async () => {
  const manifest = planFixture("idempotency", 4);
  const fake = simulated(manifest);
  const cause = new Error("response lost");
  await assert.rejects(
    scripts.run({
      manifest,
      operations: 4,
      concurrency: 1,
      mode: "simulation",
      destination: "simulation",
      transport: async (request) => {
        await fake.transport(request);
        throw cause;
      },
      inspect: fake.inspect,
    }),
    (error) => error === cause,
  );
  assert.equal(fake.calls.length, 1);
  assert.equal(
    fake.calls[0].headers["Idempotency-Key"],
    manifest.customers[0].key,
  );
  assert.equal(fake.state.orders.length, 1);
});
