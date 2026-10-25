const { randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const assert = require("node:assert/strict");
const target = require("./fixture-db");
const { TABLES } = require("../scripts/scale/records");
const { fingerprint, fingerprintRows } = require("./fingerprint");
const LOCK = 5521052;
const SCENARIOS = [
  "cart",
  "checkout-shared",
  "checkout-distinct",
  "idempotency",
  "payment",
];
const password = bcrypt.hashSync(
  "load-fixture-only",
  "$2b$06$C6UzMDM.H6dfI/f/IKcEe.",
);

function planFixture(scenario, participants) {
  if (
    !SCENARIOS.includes(scenario) ||
    !Number.isInteger(participants) ||
    participants < 1 ||
    participants > 20
  ) {
    throw new Error("Invalid fixture scenario or participant count (1..20)");
  }
  const namespace = `load-${randomUUID()}`;
  const id = (kind, index = 0) => `${namespace}-${kind}-${index}`;
  const count = scenario === "idempotency" ? 1 : participants;
  const shared = ["checkout-shared", "idempotency"].includes(scenario);
  const products = Array.from({ length: shared ? 1 : count }, (_, index) => ({
    id: id("product", index),
    inventoryId: id("inventory", index),
    movementId: id("stock", index),
    priceInCents: 1000 + index * 100,
    onHand:
      scenario === "cart"
        ? 4
        : scenario === "checkout-shared"
          ? 2
          : scenario === "payment"
            ? 2
            : 1,
  }));
  return {
    namespace,
    scenario,
    requestedOperations: participants,
    participants: count,
    at: new Date().toISOString(),
    seller: { id: id("seller"), userId: id("seller-user") },
    products,
    customers: Array.from({ length: count }, (_, index) => ({
      id: id("customer", index),
      userId: id("user", index),
      addressId: id("address", index),
      cartId: id("cart", index),
      cartItemId: id("cart-item", index),
      productId: products[shared ? 0 : index].id,
      orderId: id("order", index),
      sellerOrderId: id("seller-order", index),
      orderItemId: id("order-item", index),
      reservationId: id("reservation", index),
      reservationMovementId: id("reserve-move", index),
      key: `${namespace}:checkout:${scenario === "idempotency" ? 0 : index}`,
    })),
  };
}

function address(customer) {
  return {
    recipientName: "Load fixture",
    postalCode: "01310-100",
    street: "Fixture street",
    number: "1",
    neighborhood: "Test",
    city: "Sao Paulo",
    state: "SP",
    countryCode: "BR",
  };
}

async function lock(db, operation) {
  await target.identify(db); // Hard-coded test-only environment, including SQL/container markers.
  return db.$transaction(
    async (tx) => {
      const [row] =
        await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${LOCK}::bigint) AS acquired`;
      if (!row.acquired) {
        throw new Error("Another fixture preparation/run/recovery is active");
      }
      return operation();
    },
    { timeout: 60000 },
  );
}

async function status(db) {
  await target.identify(db);
  const [row] =
    await db.$queryRaw`SELECT * FROM scale_ops.load_experiments WHERE singleton=true`;
  return row;
}

async function save(db, state, manifest, baseline, effects = {}) {
  const payload = JSON.stringify(manifest);
  if (
    Buffer.byteLength(payload) + Buffer.byteLength(JSON.stringify(effects)) >
    128 * 1024
  ) {
    throw new Error("Fixture manifest/effect limit exceeded");
  }
  await db.$executeRaw`UPDATE scale_ops.load_experiments SET state=${state}, namespace=${manifest.namespace},
    manifest=${payload}::jsonb,baseline=${JSON.stringify(baseline)}::jsonb,effects=${JSON.stringify(effects)}::jsonb,updated_at=now()
    WHERE singleton=true`;
}

async function seed(db, manifest, hooks) {
  const at = new Date(manifest.at);
  const stamp = { createdAt: at, updatedAt: at };
  const customers = manifest.customers;
  await db.$transaction(async (tx) => {
    await tx.user.createMany({
      data: [
        {
          id: manifest.seller.userId,
          name: "Load seller",
          email: `${manifest.namespace}.seller@local.invalid`,
          normalizedEmail: `${manifest.namespace}.seller@local.invalid`,
          password,
          role: "SELLER",
          ...stamp,
        },
        ...customers.map((c, index) => ({
          id: c.userId,
          name: "Load customer",
          email: `${manifest.namespace}.${index}@local.invalid`,
          normalizedEmail: `${manifest.namespace}.${index}@local.invalid`,
          password,
          role: "CUSTOMER",
          ...stamp,
        })),
      ],
    });
    await tx.customerProfile.createMany({
      data: customers.map((c) => ({ id: c.id, userId: c.userId, ...stamp })),
    });
    await tx.seller.create({
      data: {
        id: manifest.seller.id,
        userId: manifest.seller.userId,
        storeName: manifest.namespace,
        ...stamp,
      },
    });
    await tx.customerAddress.createMany({
      data: customers.map((c) => ({
        id: c.addressId,
        customerId: c.id,
        ...address(c),
        isDefault: true,
        ...stamp,
      })),
    });
  });
  await hooks.afterStage?.(1);
  await db.$transaction(async (tx) => {
    await tx.product.createMany({
      data: manifest.products.map((p) => ({
        id: p.id,
        sellerId: manifest.seller.id,
        name: `LOAD ${p.id}`,
        reference: p.id,
        priceInCents: p.priceInCents,
        currency: "BRL",
        category: "OFFICE",
        ...stamp,
      })),
    });
    await tx.inventory.createMany({
      data: manifest.products.map((p) => ({
        id: p.inventoryId,
        productId: p.id,
        onHandQuantity: p.onHand,
        reservedQuantity: 0,
        ...stamp,
      })),
    });
    await tx.inventoryMovement.createMany({
      data: manifest.products.map((p) => ({
        id: p.movementId,
        inventoryId: p.inventoryId,
        movementType: "RESTOCK",
        onHandDelta: p.onHand,
        reservedDelta: 0,
        onHandAfter: p.onHand,
        reservedAfter: 0,
        reason: manifest.namespace,
        createdAt: at,
      })),
    });
    await tx.cart.createMany({
      data: customers.map((c) => ({
        id: c.cartId,
        customerId: c.id,
        status: manifest.scenario === "payment" ? "CONVERTED" : "ACTIVE",
        convertedAt: manifest.scenario === "payment" ? at : null,
        ...stamp,
      })),
    });
    if (manifest.scenario !== "cart" && manifest.scenario !== "payment") {
      await tx.cartItem.createMany({
        data: customers.map((c) => ({
          id: c.cartItemId,
          cartId: c.cartId,
          productId: c.productId,
          quantity: 1,
          ...stamp,
        })),
      });
    }
  });
  await hooks.afterStage?.(2);
  if (manifest.scenario === "payment") {
    await db.$transaction(async (tx) => {
      for (const c of customers) {
        const product = manifest.products.find((p) => p.id === c.productId);
        const money = {
          subtotalInCents: product.priceInCents,
          totalInCents: product.priceInCents,
          currency: "BRL",
        };
        await tx.order.create({
          data: {
            id: c.orderId,
            customerId: c.id,
            status: "PENDING_PAYMENT",
            ...money,
            ...stamp,
          },
        });
        await tx.orderAddress.create({
          data: {
            orderId: c.orderId,
            sourceAddressId: c.addressId,
            ...address(c),
            createdAt: at,
          },
        });
        await tx.sellerOrder.create({
          data: {
            id: c.sellerOrderId,
            orderId: c.orderId,
            sellerId: manifest.seller.id,
            status: "PENDING",
            ...money,
            ...stamp,
          },
        });
        await tx.orderItem.create({
          data: {
            id: c.orderItemId,
            sellerOrderId: c.sellerOrderId,
            productId: c.productId,
            quantity: 1,
            unitPriceInCents: product.priceInCents,
            lineTotalInCents: product.priceInCents,
            currency: "BRL",
            productNameSnapshot: `LOAD ${product.id}`,
            productReferenceSnapshot: product.id,
            sellerNameSnapshot: manifest.namespace,
            createdAt: at,
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: c.orderId,
            toStatus: "PENDING_PAYMENT",
            createdAt: at,
          },
        });
        await tx.sellerOrderStatusHistory.create({
          data: {
            sellerOrderId: c.sellerOrderId,
            toStatus: "PENDING",
            createdAt: at,
          },
        });
        await tx.inventoryReservation.create({
          data: {
            id: c.reservationId,
            inventoryId: product.inventoryId,
            orderItemId: c.orderItemId,
            quantity: 1,
            status: "ACTIVE",
            expiresAt: new Date(at.getTime() + 900000),
            ...stamp,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            id: c.reservationMovementId,
            inventoryId: product.inventoryId,
            orderItemId: c.orderItemId,
            movementType: "RESERVATION",
            onHandDelta: 0,
            reservedDelta: 1,
            onHandAfter: product.onHand,
            reservedAfter: 1,
            createdAt: at,
          },
        });
        await tx.inventory.update({
          where: { id: product.inventoryId },
          data: { reservedQuantity: 1 },
        });
      }
    });
  }
  await hooks.afterStage?.(3);
}

async function prepare(db, scenario, participants, hooks = {}) {
  return lock(db, async () => {
    const previous = await status(db);
    if (!["EMPTY", "RECOVERED"].includes(previous.state)) {
      throw new Error(
        "Previous fixture is not reconciled/recovered; refusing preparation",
      );
    }
    const manifest = planFixture(scenario, participants);
    const baseline = await fingerprint(db);
    await save(db, "PREPARING", manifest, baseline);
    try {
      await seed(db, manifest, hooks);
      await save(db, "READY", manifest, baseline);
      return manifest;
    } catch (error) {
      try {
        await save(db, "UNKNOWN", manifest, baseline, {
          reason:
            "Preparation did not complete; explicit read reconciliation required",
        });
      } catch {
        error.controlStateUncertain = true;
      }
      throw error;
    }
  });
}

function owned(condition, message) {
  if (!condition) {
    throw new Error(`Unsafe fixture graph: ${message}`);
  }
}

function validateManifest(manifest) {
  owned(
    manifest &&
      /^load-[0-9a-f-]{36}$/.test(manifest.namespace) &&
      SCENARIOS.includes(manifest.scenario),
    "invalid namespace/scenario",
  );
  owned(
    Number.isInteger(manifest.participants) &&
      manifest.participants >= 1 &&
      manifest.participants <= 20,
    "participant cap",
  );
  owned(
    Array.isArray(manifest.customers) &&
      manifest.customers.length === manifest.participants &&
      Array.isArray(manifest.products) &&
      manifest.products.length >= 1 &&
      manifest.products.length <= 21,
    "root caps",
  );
  const ids = [
    manifest.seller?.id,
    manifest.seller?.userId,
    ...manifest.products.flatMap((p) => [p.id, p.inventoryId, p.movementId]),
    ...manifest.customers.flatMap((c) => [
      c.id,
      c.userId,
      c.addressId,
      c.cartId,
      c.cartItemId,
      c.orderId,
      c.sellerOrderId,
      c.orderItemId,
      c.reservationId,
      c.reservationMovementId,
    ]),
  ];
  owned(
    ids.every(
      (id) => typeof id === "string" && id.startsWith(`${manifest.namespace}-`),
    ) && new Set(ids).size === ids.length,
    "IDs outside namespace or duplicated",
  );
  owned(
    manifest.customers.every((c) =>
      manifest.products.some((p) => p.id === c.productId),
    ),
    "customer/product ownership",
  );
  owned(Number.isFinite(Date.parse(manifest.at)), "invalid fixture date");
}

async function graph(tx, manifest) {
  validateManifest(manifest);
  const map = Object.fromEntries(TABLES.map(([model]) => [model, []]));
  const select = async (model, where) => {
    const rows = await tx[model].findMany({
      where,
      take: 513,
      orderBy: { id: "asc" },
    });
    owned(rows.length <= 512, "table record cap");
    map[model] = rows.map((r) => r.id);
    return rows;
  };
  const users = [
    ...manifest.customers.map((c) => c.userId),
    manifest.seller.userId,
  ];
  const customers = manifest.customers.map((c) => c.id);
  const addresses = manifest.customers.map((c) => c.addressId);
  const products = manifest.products.map((p) => p.id);
  const inventories = manifest.products.map((p) => p.inventoryId);
  const u = await select("user", { id: { in: users } });
  owned(
    u.every((r) => r.normalizedEmail.startsWith(`${manifest.namespace}.`)),
    "user identity",
  );
  const c = await select("customerProfile", {
    OR: [{ id: { in: customers } }, { userId: { in: users } }],
  });
  owned(
    c.every((r) =>
      manifest.customers.some((m) => m.id === r.id && m.userId === r.userId),
    ),
    "customer/user crossing",
  );
  const s = await select("seller", {
    OR: [{ id: manifest.seller.id }, { userId: { in: users } }],
  });
  owned(
    s.every(
      (r) => r.id === manifest.seller.id && r.userId === manifest.seller.userId,
    ),
    "seller/user crossing",
  );
  const a = await select("customerAddress", {
    OR: [{ id: { in: addresses } }, { customerId: { in: customers } }],
  });
  owned(
    a.every((r) =>
      manifest.customers.some(
        (m) => m.addressId === r.id && m.id === r.customerId,
      ),
    ),
    "address ownership",
  );
  const p = await select("product", {
    OR: [{ id: { in: products } }, { sellerId: manifest.seller.id }],
  });
  owned(
    p.every(
      (r) => products.includes(r.id) && r.sellerId === manifest.seller.id,
    ),
    "product ownership",
  );
  const inv = await select("inventory", {
    OR: [{ id: { in: inventories } }, { productId: { in: products } }],
  });
  owned(
    inv.every((r) =>
      manifest.products.some(
        (m) => m.id === r.productId && m.inventoryId === r.id,
      ),
    ),
    "inventory ownership",
  );
  const carts = await select("cart", { customerId: { in: customers } });
  owned(carts.length <= 20, "too many carts");
  const ci = await select("cartItem", {
    OR: [{ cartId: { in: map.cart } }, { productId: { in: products } }],
  });
  owned(
    ci.every(
      (r) => map.cart.includes(r.cartId) && products.includes(r.productId),
    ),
    "cart/product crossing",
  );
  const orders = await select("order", { customerId: { in: customers } });
  owned(orders.length <= 20, "too many orders");
  const oa = await select("orderAddress", {
    OR: [
      { orderId: { in: map.order } },
      { sourceAddressId: { in: addresses } },
    ],
  });
  owned(
    oa.every(
      (r) =>
        map.order.includes(r.orderId) && addresses.includes(r.sourceAddressId),
    ),
    "order/address crossing",
  );
  const so = await select("sellerOrder", {
    OR: [{ orderId: { in: map.order } }, { sellerId: manifest.seller.id }],
  });
  owned(
    so.every(
      (r) => map.order.includes(r.orderId) && r.sellerId === manifest.seller.id,
    ),
    "order/seller crossing",
  );
  const items = await select("orderItem", {
    OR: [
      { sellerOrderId: { in: map.sellerOrder } },
      { productId: { in: products } },
    ],
  });
  owned(
    items.every(
      (r) =>
        map.sellerOrder.includes(r.sellerOrderId) &&
        products.includes(r.productId) &&
        r.lineTotalInCents === r.quantity * r.unitPriceInCents,
    ),
    "order item crossing/money",
  );
  const payments = await select("paymentAttempt", {
    orderId: { in: map.order },
  });
  owned(
    payments.every(
      (r) =>
        r.provider === "DEV_SIMULATOR" &&
        r.status !== "CAPTURED" &&
        (!r.providerReference || r.providerReference.startsWith("dev_")) &&
        r.amountInCents === orders.find((o) => o.id === r.orderId).totalInCents,
    ),
    "external, captured or inconsistent payment",
  );
  const refunds = await select("refund", {
    paymentAttemptId: { in: map.paymentAttempt },
  });
  const deliveries = await select("delivery", {
    sellerOrderId: { in: map.sellerOrder },
  });
  const reviews = await select("review", {
    OR: [
      { userId: { in: users } },
      { productId: { in: products } },
      { sellerId: manifest.seller.id },
    ],
  });
  owned(
    refunds.length + deliveries.length + reviews.length === 0,
    "unexpected refund/delivery/review requires manual investigation",
  );
  await select("orderStatusHistory", { orderId: { in: map.order } });
  await select("sellerOrderStatusHistory", {
    sellerOrderId: { in: map.sellerOrder },
  });
  const reservations = await select("inventoryReservation", {
    OR: [
      { inventoryId: { in: inventories } },
      { orderItemId: { in: map.orderItem } },
    ],
  });
  owned(
    reservations.every(
      (r) =>
        inventories.includes(r.inventoryId) &&
        map.orderItem.includes(r.orderItemId),
    ),
    "reservation crossing",
  );
  const movements = await select("inventoryMovement", {
    OR: [
      { inventoryId: { in: inventories } },
      { orderItemId: { in: map.orderItem } },
    ],
  });
  owned(
    movements.every(
      (r) =>
        inventories.includes(r.inventoryId) &&
        (!r.orderItemId || map.orderItem.includes(r.orderItemId)),
    ),
    "movement crossing",
  );
  const keys = await select("idempotencyKey", {
    OR: [{ userId: { in: users } }, { orderId: { in: map.order } }],
  });
  owned(
    keys.every(
      (r) =>
        users.includes(r.userId) &&
        (!r.orderId || map.order.includes(r.orderId)),
    ),
    "idempotency crossing",
  );
  for (const row of inv) {
    owned(
      row.reservedQuantity ===
        reservations
          .filter((r) => r.inventoryId === row.id && r.status === "ACTIVE")
          .reduce((sum, r) => sum + r.quantity, 0),
      "reserved balance",
    );
    owned(
      row.onHandQuantity ===
        movements
          .filter((r) => r.inventoryId === row.id)
          .reduce((sum, r) => sum + r.onHandDelta, 0),
      "physical balance",
    );
    owned(
      row.reservedQuantity ===
        movements
          .filter((r) => r.inventoryId === row.id)
          .reduce((sum, r) => sum + r.reservedDelta, 0),
      "movement/reservation balance",
    );
  }
  for (const row of orders) {
    owned(
      row.totalInCents ===
        so
          .filter((r) => r.orderId === row.id)
          .reduce((sum, r) => sum + r.totalInCents, 0),
      "order total",
    );
  }
  for (const row of so) {
    owned(
      row.totalInCents ===
        items
          .filter((r) => r.sellerOrderId === row.id)
          .reduce((sum, r) => sum + r.lineTotalInCents, 0),
      "seller order total",
    );
  }
  owned(
    Object.values(map).reduce((sum, ids) => sum + ids.length, 0) <= 512,
    "graph record cap",
  );
  return map;
}

async function reconcile(db) {
  await target.identify(db);
  const control = await status(db);
  if (["EMPTY", "RECOVERED"].includes(control.state)) {
    return { state: control.state, effects: {} };
  }
  const effects = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return graph(tx, control.manifest);
  });
  return { state: control.state, namespace: control.namespace, effects };
}

async function recover(db, acknowledgement, hooks = {}) {
  if (acknowledgement !== "API_AND_RUNNER_STOPPED") {
    throw new Error("Explicit stopped API/runner acknowledgement required");
  }
  return lock(db, async () => {
    const control = await status(db);
    if (["EMPTY", "RECOVERED"].includes(control.state)) {
      throw new Error("No recoverable fixture");
    }
    return db.$transaction(
      async (tx) => {
        const [sessions] =
          await tx.$queryRaw`SELECT count(*)::integer AS count FROM pg_stat_activity
        WHERE datname=current_database() AND pid<>pg_backend_pid() AND application_name<>'load-fixture-controller'`;
        owned(
          sessions.count === 0,
          "an API/other database client may still be active",
        );
        const effects = await graph(tx, control.manifest);
        const excluded = Object.fromEntries(
          TABLES.map(([model, table]) => [table, effects[model]]),
        );
        assert.deepEqual(
          await fingerprintRows(tx, excluded),
          control.baseline,
          "Historical rows changed; recovery refused",
        );
        await hooks.beforeDelete?.();
        for (const [model] of [...TABLES].reverse()) {
          if (effects[model].length) {
            await tx[model].deleteMany({
              where: { id: { in: effects[model] } },
            });
          }
        }
        await hooks.afterDelete?.();
        assert.deepEqual(
          await fingerprintRows(tx),
          control.baseline,
          "Historical signature did not recover",
        );
        await save(
          tx,
          "RECOVERED",
          control.manifest,
          control.baseline,
          effects,
        );
        return { state: "RECOVERED", effects, baselineIntact: true };
      },
      { timeout: 30000, isolationLevel: "Serializable" },
    );
  });
}

async function runTest(db, operation) {
  return lock(db, async () => {
    const control = await status(db);
    if (control.state !== "READY") {
      throw new Error("Fixture is not ready for an explicit test run");
    }
    await save(db, "RUNNING", control.manifest, control.baseline);
    try {
      const result = await operation(control.manifest);
      const observed = await db.$transaction((tx) =>
        graph(tx, control.manifest),
      );
      await save(db, "READY", control.manifest, control.baseline, observed);
      return result;
    } catch (error) {
      try {
        await save(db, "UNKNOWN", control.manifest, control.baseline, {
          reason: "Run result unknown; reconcile by read, no retry",
        });
      } catch {
        error.controlStateUncertain = true;
      }
      throw error;
    }
  });
}

module.exports = {
  planFixture,
  validateManifest,
  prepare,
  status,
  reconcile,
  recover,
  runTest,
  graph,
};
