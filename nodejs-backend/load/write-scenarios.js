const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const { validateManifest } = require("./fixture-manager");

function assertMode(mode, destination) {
  if (mode === "simulation" && destination === "simulation") {
    return;
  }
  if (mode === "fixture-test" && destination === "http://127.0.0.1:8052") {
    return;
  }
  throw new Error(
    "Scale writes are not authorized; only simulation or the dedicated fixture-test API is supported",
  );
}

function checkoutBody(response, customer, manifest) {
  const product = manifest.products.find((p) => p.id === customer.productId);
  const order = response.body;
  assert.equal(order.status, "PENDING_PAYMENT");
  assert.equal(order.totalInCents, product.priceInCents);
  assert.equal(order.currency, "BRL");
  assert.equal(order.address.sourceAddressId, customer.addressId);
  assert.equal(order.sellerOrders.length, 1);
  const so = order.sellerOrders[0];
  assert.equal(so.sellerId, manifest.seller.id);
  assert.equal(so.items.length, 1);
  assert.equal(so.items[0].productId, product.id);
  assert.equal(so.items[0].quantity, 1);
  assert.equal(so.items[0].lineTotalInCents, product.priceInCents);
  assert.ok(typeof order.id === "string" && order.id.length > 0);
  return order.id;
}

async function coordinated(tasks, concurrency, operation) {
  const results = [];
  for (let offset = 0; offset < tasks.length; offset += concurrency) {
    const batch = tasks.slice(offset, offset + concurrency);
    let release;
    const barrier = new Promise((resolve) => {
      release = resolve;
    });
    let ready = 0;
    const pending = batch.map(async (task) => {
      ready += 1;
      await barrier;
      return operation(task);
    });
    assert.equal(ready, batch.length);
    release();
    const settled = await Promise.allSettled(pending);
    const failed = settled.find((r) => r.status === "rejected");
    results.push(
      ...settled.filter((r) => r.status === "fulfilled").map((r) => r.value),
    );
    if (failed) {
      failed.reason.partialResponses = results.length;
      throw failed.reason; // Waited for in-flight calls; never retries or starts another batch.
    }
  }
  return results;
}

async function run({
  manifest,
  operations,
  concurrency = 1,
  mode,
  destination,
  transport,
  inspect,
  paymentVariant = "duplicate",
}) {
  assertMode(mode, destination);
  validateManifest(manifest);
  if (
    !Number.isInteger(operations) ||
    operations < 1 ||
    operations > 20 ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 4 ||
    typeof transport !== "function" ||
    typeof inspect !== "function"
  ) {
    throw new Error("Invalid bounded write test configuration");
  }
  const shared =
    manifest.scenario === "idempotency" ||
    (manifest.scenario === "payment" && paymentVariant === "duplicate");
  if (!shared && manifest.customers.length < operations) {
    throw new Error(
      "Each independent operation requires its own customer fixture",
    );
  }
  if (
    manifest.scenario === "payment" &&
    !["duplicate", "independent"].includes(paymentVariant)
  ) {
    throw new Error("Invalid payment variant");
  }
  const summary = {
    operations,
    concurrency,
    requests: 0,
    success: 0,
    expectedConflicts: 0,
    replays: 0,
    technicalErrors: 0,
    firstDispatchAt: null,
    lastDispatchAt: null,
    result: "running",
  };
  const orderIds = new Set();
  const tasks = Array.from({ length: operations }, (_, index) => ({
    customer: manifest.customers[shared ? 0 : index],
    index,
  }));
  const send = async (customer, method, path, body, headers = {}) => {
    summary.requests += 1;
    const started = performance.now();
    summary.firstDispatchAt ??= started;
    summary.lastDispatchAt = started;
    const response = await transport({
      customerId: customer.id,
      userId: customer.userId,
      method,
      path,
      body,
      headers,
      timeoutMs: 10000,
    });
    if (!response || !Number.isInteger(response.status)) {
      throw new Error(
        "Unknown HTTP outcome; reconcile the same fixture/key, do not retry",
      );
    }
    return response;
  };
  try {
    await coordinated(tasks, concurrency, async ({ customer }) => {
      const product = manifest.products.find(
        (p) => p.id === customer.productId,
      );
      if (manifest.scenario === "cart") {
        const added = await send(customer, "POST", "/cart/items", {
          productId: product.id,
          quantity: 1,
        });
        assert.equal(added.status, 201);
        assert.equal(added.body.items.length, 1);
        assert.equal(added.body.items[0].quantity, 1);
        assert.equal(added.body.totalInCents, product.priceInCents);
        const updated = await send(
          customer,
          "PUT",
          `/cart/items/${product.id}`,
          { quantity: 2 },
        );
        assert.equal(updated.status, 200);
        assert.equal(updated.body.items[0].quantity, 2);
        assert.equal(
          updated.body.items[0].lineTotalInCents,
          product.priceInCents * 2,
        );
        assert.equal(updated.body.totalInCents, product.priceInCents * 2);
        assert.equal(updated.body.items[0].hasSufficientStock, true);
        summary.success += 1;
      } else if (manifest.scenario === "payment") {
        const response = await send(
          customer,
          "POST",
          `/orders/${customer.orderId}/payment-attempts`,
          { method: "PIX" },
        );
        if (response.status === 201) {
          assert.equal(response.body.orderId, customer.orderId);
          assert.equal(response.body.amountInCents, product.priceInCents);
          assert.equal(response.body.currency, "BRL");
          assert.equal(response.body.method, "PIX");
          assert.equal(response.body.status, "CREATED");
          assert.equal(response.body.provider, "DEV_SIMULATOR");
          assert.ok(response.body.providerReference?.startsWith("dev_"));
          summary.success += 1;
        } else {
          assert.equal(response.status, 409);
          assert.equal(
            response.body.error,
            "Order already has an active or captured payment attempt",
          );
          summary.expectedConflicts += 1;
        }
      } else {
        const response = await send(
          customer,
          "POST",
          "/checkout",
          { addressId: customer.addressId },
          { "Idempotency-Key": customer.key },
        );
        if (
          response.status === 201 ||
          (manifest.scenario === "idempotency" && response.status === 200)
        ) {
          orderIds.add(checkoutBody(response, customer, manifest));
          if (response.status === 200) {
            assert.equal(response.headers?.["Idempotency-Replayed"], "true");
            summary.replays += 1;
          } else {
            summary.success += 1;
          }
        } else {
          assert.equal(response.status, 409);
          const reason =
            manifest.scenario === "idempotency"
              ? "Idempotency key is processing"
              : "Cart stock is insufficient";
          assert.equal(response.body.error, reason);
          assert.ok(
            ["idempotency", "checkout-shared"].includes(manifest.scenario),
          );
          summary.expectedConflicts += 1;
        }
      }
    });
    const state = await inspect(manifest); // Authoritative persisted postconditions, not HTTP status alone.
    if (manifest.scenario === "cart") {
      assert.equal(state.cartItems.length, operations);
      assert.ok(state.cartItems.every((item) => item.quantity === 2));
      assert.ok(
        state.inventories.every(
          (row) => row.reservedQuantity === 0 && row.onHandQuantity === 4,
        ),
      );
    } else if (manifest.scenario === "payment") {
      const expected = shared ? 1 : operations;
      assert.equal(summary.success, expected);
      assert.equal(state.attempts.length, expected);
      assert.ok(
        state.attempts.every(
          (attempt) =>
            attempt.status === "CREATED" &&
            attempt.amountInCents ===
              state.orders.find((o) => o.id === attempt.orderId).totalInCents,
        ),
      );
      assert.ok(
        state.orders.every((order) => order.status === "PENDING_PAYMENT"),
      );
    } else {
      const expected =
        manifest.scenario === "idempotency"
          ? 1
          : manifest.scenario === "checkout-shared"
            ? Math.min(operations, 2)
            : operations;
      assert.equal(summary.success, expected);
      assert.equal(state.orders.length, expected);
      assert.equal(orderIds.size, expected);
      assert.equal(state.reservations.length, expected);
      assert.equal(state.keys.length, expected);
      assert.ok(
        state.keys.every(
          (key) => key.status === "COMPLETED" && orderIds.has(key.orderId),
        ),
      );
      assert.ok(
        state.inventories.every(
          (row) =>
            row.reservedQuantity >= 0 &&
            row.reservedQuantity <= row.onHandQuantity,
        ),
      );
      if (manifest.scenario === "idempotency") {
        assert.equal(
          summary.success + summary.replays + summary.expectedConflicts,
          operations,
        );
      }
    }
    summary.result = "verified";
    return summary;
  } catch (error) {
    summary.result = "unknown-or-invalid";
    summary.technicalErrors += 1;
    error.writeSummary = summary;
    throw error;
  }
}

async function inspectTestDb(db, manifest) {
  const { graph } = require("./fixture-manager");
  const { identify } = require("./fixture-db");
  await identify(db);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const ids = await graph(tx, manifest);
    return {
      cartItems: await tx.cartItem.findMany({
        where: { id: { in: ids.cartItem } },
      }),
      inventories: await tx.inventory.findMany({
        where: { id: { in: ids.inventory } },
      }),
      orders: await tx.order.findMany({ where: { id: { in: ids.order } } }),
      attempts: await tx.paymentAttempt.findMany({
        where: { id: { in: ids.paymentAttempt } },
      }),
      reservations: await tx.inventoryReservation.findMany({
        where: { id: { in: ids.inventoryReservation } },
      }),
      keys: await tx.idempotencyKey.findMany({
        where: { id: { in: ids.idempotencyKey } },
      }),
    };
  });
}

module.exports = { run, coordinated, assertMode, inspectTestDb };
