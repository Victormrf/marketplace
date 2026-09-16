const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { PrismaClient, UserRole, ProductCategory, Currency } = require("@prisma/client");
const { CheckoutService, toCheckoutDto } = require("../dist/services/checkoutService");
const { CheckoutRepository } = require("../dist/repositories/checkoutRepository");

const raw = process.env.DATABASE_URL || "";
const target = new URL(raw);
if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.port !== "5433" || target.pathname !== "/marketplace_dev") {
  throw new Error("test:checkout requires localhost:5433/marketplace_dev");
}
const prisma = new PrismaClient();
const checkout = new CheckoutService();
const call = (service, userId, addressId, key) => service.checkout(userId, { addressId }, key);
const id = {
  a: "77000000-0000-0000-0000-000000000001", ap: "77000000-0000-0000-0000-000000000002", aa: "77000000-0000-0000-0000-000000000003",
  b: "77000000-0000-0000-0000-000000000004", bp: "77000000-0000-0000-0000-000000000005", ba: "77000000-0000-0000-0000-000000000006",
  su1: "77000000-0000-0000-0000-000000000007", s1: "77000000-0000-0000-0000-000000000008",
  su2: "77000000-0000-0000-0000-000000000009", s2: "77000000-0000-0000-0000-000000000010",
  admin: "77000000-0000-0000-0000-000000000011", p1: "77000000-0000-0000-0000-000000000012", p2: "77000000-0000-0000-0000-000000000013",
  p3: "77000000-0000-0000-0000-000000000014", p4: "77000000-0000-0000-0000-000000000015",
};
const userIds = [id.a, id.b, id.su1, id.su2, id.admin];
const profileIds = [id.ap, id.bp];
const productIds = [id.p1, id.p2, id.p3, id.p4];
const sellerIds = [id.s1, id.s2];

async function cleanup() {
  await prisma.idempotencyKey.deleteMany({ where: { userId: { in: userIds } } });
  const orders = await prisma.order.findMany({ where: { customerId: { in: profileIds } }, select: { id: true } });
  const orderIds = orders.map((o) => o.id);
  const sellerOrders = orderIds.length ? await prisma.sellerOrder.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } }) : [];
  const sellerOrderIds = sellerOrders.map((o) => o.id);
  const orderItems = sellerOrderIds.length ? await prisma.orderItem.findMany({ where: { sellerOrderId: { in: sellerOrderIds } }, select: { id: true } }) : [];
  const orderItemIds = orderItems.map((o) => o.id);
  if (orderItemIds.length) { await prisma.inventoryMovement.deleteMany({ where: { orderItemId: { in: orderItemIds } } }); await prisma.inventoryReservation.deleteMany({ where: { orderItemId: { in: orderItemIds } } }); }
  if (orderIds.length) { await prisma.orderAddress.deleteMany({ where: { orderId: { in: orderIds } } }); await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } }); await prisma.paymentAttempt.deleteMany({ where: { orderId: { in: orderIds } } }); }
  if (sellerOrderIds.length) { await prisma.sellerOrderStatusHistory.deleteMany({ where: { sellerOrderId: { in: sellerOrderIds } } }); await prisma.orderItem.deleteMany({ where: { sellerOrderId: { in: sellerOrderIds } } }); await prisma.sellerOrder.deleteMany({ where: { id: { in: sellerOrderIds } } }); }
  if (orderIds.length) await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.cartItem.deleteMany({ where: { cart: { customerId: { in: profileIds } } } });
  await prisma.cart.deleteMany({ where: { customerId: { in: profileIds } } });
  await prisma.inventoryMovement.deleteMany({ where: { inventory: { productId: { in: productIds } } } });
  await prisma.inventoryReservation.deleteMany({ where: { inventory: { productId: { in: productIds } } } });
  await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.customerAddress.deleteMany({ where: { customerId: { in: profileIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await prisma.customerProfile.deleteMany({ where: { id: { in: profileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function setup() {
  await cleanup();
  await prisma.user.createMany({ data: [
    { id: id.a, name: "Checkout A", email: "step7-a@local.invalid", normalizedEmail: "step7-a@local.invalid", password: "hash", role: UserRole.CUSTOMER },
    { id: id.b, name: "Checkout B", email: "step7-b@local.invalid", normalizedEmail: "step7-b@local.invalid", password: "hash", role: UserRole.CUSTOMER },
    { id: id.su1, name: "Seller One", email: "step7-s1@local.invalid", normalizedEmail: "step7-s1@local.invalid", password: "hash", role: UserRole.SELLER },
    { id: id.su2, name: "Seller Two", email: "step7-s2@local.invalid", normalizedEmail: "step7-s2@local.invalid", password: "hash", role: UserRole.SELLER },
    { id: id.admin, name: "Checkout Admin", email: "step7-admin@local.invalid", normalizedEmail: "step7-admin@local.invalid", password: "hash", role: UserRole.ADMIN },
  ] });
  await prisma.customerProfile.createMany({ data: [{ id: id.ap, userId: id.a, phone: "11999990000" }, { id: id.bp, userId: id.b }] });
  await prisma.customerAddress.createMany({ data: [
    { id: id.aa, customerId: id.ap, recipientName: "Checkout Recipient", postalCode: "01311000", street: "Paulista", number: "100", neighborhood: "Bela Vista", city: "Sao Paulo", state: "SP", countryCode: "BR", phone: "11999990000", isDefault: true },
    { id: id.ba, customerId: id.bp, recipientName: "Other Recipient", postalCode: "20000000", street: "Other", number: "2", neighborhood: "Centro", city: "Rio", state: "RJ", countryCode: "BR", isDefault: true },
  ] });
  await prisma.seller.createMany({ data: [{ id: id.s1, userId: id.su1, storeName: "Seller One Store" }, { id: id.s2, userId: id.su2, storeName: "Seller Two Store" }] });
  await prisma.product.createMany({ data: [
    { id: id.p1, sellerId: id.s1, name: "Product One", reference: "ONE", priceInCents: 1200, currency: Currency.BRL, category: ProductCategory.OFFICE },
    { id: id.p2, sellerId: id.s2, name: "Product Two", reference: "TWO", priceInCents: 800, currency: Currency.BRL, category: ProductCategory.BOOKS },
    { id: id.p3, sellerId: id.s1, name: "Product Three", reference: "THREE", priceInCents: 500, currency: Currency.BRL, category: ProductCategory.TOYS },
    { id: id.p4, sellerId: id.s1, name: "Product Four", reference: "FOUR", priceInCents: 700, currency: Currency.BRL, category: ProductCategory.PETS },
  ] });
  await prisma.inventory.createMany({ data: productIds.map((productId) => ({ productId, onHandQuantity: 10, reservedQuantity: 0 })) });
}

async function add(customerId, productId, quantity) {
  const profileId = customerId === id.a ? id.ap : id.bp;
  await prisma.cart.upsert({ where: { id: customerId === id.a ? "77000000-0000-0000-0000-000000000016" : "77000000-0000-0000-0000-000000000017" }, update: {}, create: { id: customerId === id.a ? "77000000-0000-0000-0000-000000000016" : "77000000-0000-0000-0000-000000000017", customerId: profileId, status: "ACTIVE" } });
  const cart = await prisma.cart.findFirst({ where: { customerId: profileId, status: "ACTIVE" } });
  await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
}

test.beforeEach(async () => setup());
test.after(async () => {
  await cleanup();
  assert.equal(await prisma.user.count({ where: { id: { in: userIds } } }), 0);
  assert.equal(await prisma.product.count({ where: { id: { in: productIds } } }), 0);
  await prisma.$disconnect();
});

test("performs multi-seller checkout with totals, snapshots, reservations and movements", async () => {
  await add(id.a, id.p1, 2); await add(id.a, id.p2, 1);
  const result = (await call(checkout, id.a, id.aa, "key-valid")).result;
  assert.equal(result.status, "PENDING_PAYMENT"); assert.equal(result.subtotalInCents, 3200); assert.equal(result.totalInCents, 3200); assert.equal(result.currency, "BRL");
  assert.equal(result.sellerOrders.length, 2); assert.equal(result.sellerOrders[0].items.length, 1);
  assert.equal(result.address.sourceAddressId, id.aa); assert.equal(result.address.recipientName, "Checkout Recipient");
  const items = result.sellerOrders.flatMap((so) => so.items); assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.reservation?.status === "ACTIVE")); assert.deepEqual(items.map((item) => item.productNameSnapshot).sort(), ["Product One", "Product Two"]);
  const inv = await prisma.inventory.findUnique({ where: { productId: id.p1 } }); assert.equal(inv.onHandQuantity, 10); assert.equal(inv.reservedQuantity, 2);
  const movement = await prisma.inventoryMovement.findFirst({ where: { orderItemId: items.find((i) => i.productId === id.p1).id } }); assert.equal(movement.movementType, "RESERVATION"); assert.equal(movement.onHandDelta, 0); assert.equal(movement.reservedDelta, 2); assert.equal(movement.onHandAfter, 10); assert.equal(movement.reservedAfter, 2);
  assert.ok((await prisma.inventoryReservation.findFirst({ where: { orderItemId: items.find((i) => i.productId === id.p1).id } })).expiresAt > new Date());
  assert.equal((await prisma.cart.findFirst({ where: { customerId: id.ap } })).status, "CONVERTED");
});

test("preserves the address snapshot and rejects invalid or protected requests", async () => {
  await assert.rejects(() => checkout.checkout(id.a, { addressId: id.aa, items: [] }, "key-invalid-body"), /Only addressId/);
  await add(id.a, id.p1, 1);
  await assert.rejects(() => call(checkout, id.a, id.ba, "key-wrong-address"), /Address not found/);
  await assert.rejects(() => call(checkout, id.su1, id.aa, "key-seller"), /permission/i);
  await assert.rejects(() => call(checkout, id.admin, id.aa, "key-admin"), /permission/i);
  const result = (await call(checkout, id.a, id.aa, "key-snapshot")).result;
  await prisma.customerAddress.update({ where: { id: id.aa }, data: { recipientName: "Changed Later" } });
  const snapshot = await prisma.orderAddress.findUnique({ where: { orderId: result.id } }); assert.equal(snapshot.recipientName, "Checkout Recipient");
});

test("rejects empty, inactive and insufficient carts without conversion", async () => {
  await assert.rejects(() => call(checkout, id.a, id.aa, "key-empty"), /empty|not found/i);
  await add(id.a, id.p1, 1);
  await prisma.customerAddress.update({ where: { id: id.aa }, data: { isActive: false } });
  await assert.rejects(() => call(checkout, id.a, id.aa, "key-inactive-address"), /Address not found/);
  await prisma.customerAddress.update({ where: { id: id.aa }, data: { isActive: true } });
  await add(id.a, id.p3, 1); await prisma.product.update({ where: { id: id.p3 }, data: { isActive: false } });
  await assert.rejects(() => call(checkout, id.a, id.aa, "key-inactive-product"), /unavailable/i);
  assert.equal((await prisma.cart.findFirst({ where: { customerId: id.ap } })).status, "ACTIVE");
  await prisma.product.update({ where: { id: id.p3 }, data: { isActive: true } });
  await prisma.inventory.update({ where: { productId: id.p3 }, data: { onHandQuantity: 0 } });
  await assert.rejects(() => call(checkout, id.a, id.aa, "key-insufficient"), /insufficient/i);
  assert.equal(await prisma.order.count({ where: { customerId: id.ap } }), 0);
});

test("two concurrent checkouts of one cart yield one order", async () => {
  await add(id.a, id.p1, 1);
  const results = await Promise.allSettled([call(checkout, id.a, id.aa, "key-concurrent-a"), call(checkout, id.a, id.aa, "key-concurrent-b")]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1); assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  assert.equal(await prisma.order.count({ where: { customerId: id.ap } }), 1); assert.equal(await prisma.cart.count({ where: { customerId: id.ap, status: "CONVERTED" } }), 1);
});

test("competing customers cannot oversell the same inventory", async () => {
  await prisma.inventory.update({ where: { productId: id.p4 }, data: { onHandQuantity: 2 } });
  await add(id.a, id.p4, 2); await add(id.b, id.p4, 2);
  const results = await Promise.allSettled([call(checkout, id.a, id.aa, "key-compete-a"), call(checkout, id.b, id.ba, "key-compete-b")]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1); assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  const inv = await prisma.inventory.findUnique({ where: { productId: id.p4 } }); assert.equal(inv.reservedQuantity, 2); assert.equal(inv.onHandQuantity, 2);
  assert.equal(await prisma.inventoryReservation.count({ where: { inventoryId: inv.id } }), 1);
});

test("maps persistence records to an explicit DTO without leaking extra fields", () => {
  const record = {
    id: "order", status: "PENDING_PAYMENT", subtotalInCents: 1, shippingInCents: 0, taxInCents: 0,
    discountInCents: 0, totalInCents: 1, currency: "BRL", createdAt: new Date(), updatedAt: new Date(),
    address: null, sellerOrders: [], internalSecret: "must-not-leak",
  };
  const dto = toCheckoutDto(record);
  assert.equal(dto.internalSecret, undefined);
  assert.deepEqual(Object.keys(dto).sort(), ["address", "createdAt", "currency", "discountInCents", "id", "sellerOrders", "shippingInCents", "status", "subtotalInCents", "taxInCents", "totalInCents", "updatedAt"]);
});

test("holds a real Product lock until commit and rolls back an intermediate failure", async () => {
  await add(id.a, id.p1, 1);
  let release;
  let reached;
  const reachedPromise = new Promise((resolve) => { reached = resolve; });
  const releasePromise = new Promise((resolve) => { release = resolve; });
  const repository = new CheckoutRepository({
    afterLocks: async () => { reached(); await releasePromise; },
    afterFirstOrderItem: async () => { throw new Error("deterministic failure"); },
  });
  const service = new CheckoutService(repository);
  const checkoutPromise = service.checkout(id.a, { addressId: id.aa }, "key-rollback-lock");
  await reachedPromise;
  const updater = prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '100ms'");
    await tx.product.update({ where: { id: id.p1 }, data: { name: "Should Wait" } });
  });
  await assert.rejects(updater, /lock timeout|could not obtain lock/i);
  release();
  await assert.rejects(checkoutPromise, /deterministic failure/);
  await prisma.product.update({ where: { id: id.p1 }, data: { name: "After rollback" } });
  const after = await prisma.product.findUnique({ where: { id: id.p1 } });
  assert.equal(after.name, "After rollback");
  assert.equal(await prisma.order.count({ where: { customerId: id.ap } }), 0);
  assert.equal(await prisma.sellerOrder.count({ where: { order: { customerId: id.ap } } }), 0);
  assert.equal(await prisma.inventoryReservation.count({ where: { inventory: { productId: id.p1 } } }), 0);
  assert.equal(await prisma.inventoryMovement.count({ where: { inventory: { productId: id.p1 } } }), 0);
  const cart = await prisma.cart.findFirst({ where: { customerId: id.ap, status: "ACTIVE" }, include: { items: true } });
  assert.ok(cart); assert.equal(cart.items.length, 1);
});

test("holds Seller and CustomerAddress locks through snapshot creation", async () => {
  await add(id.a, id.p1, 1);
  let release;
  let reached;
  const reachedPromise = new Promise((resolve) => { reached = resolve; });
  const releasePromise = new Promise((resolve) => { release = resolve; });
  const repository = new CheckoutRepository({ afterLocks: async () => { reached(); await releasePromise; } });
  const pending = new CheckoutService(repository).checkout(id.a, { addressId: id.aa }, "key-seller-address-lock");
  await reachedPromise;
  const blockedSeller = prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '100ms'"); await tx.seller.update({ where: { id: id.s1 }, data: { storeName: "Changed" } }); });
  const blockedAddress = prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '100ms'"); await tx.customerAddress.update({ where: { id: id.aa }, data: { recipientName: "Changed" } }); });
  const sellerRejected = assert.rejects(blockedSeller, /lock timeout|could not obtain lock/i);
  const addressRejected = assert.rejects(blockedAddress, /lock timeout|could not obtain lock/i);
  await Promise.all([sellerRejected, addressRejected]);
  release();
  const result = (await pending).result;
  assert.equal(result.sellerOrders[0].items[0].sellerNameSnapshot, "Seller One Store");
  assert.equal(result.address.recipientName, "Checkout Recipient");
  await prisma.seller.update({ where: { id: id.s1 }, data: { storeName: "Changed" } });
  await prisma.customerAddress.update({ where: { id: id.aa }, data: { recipientName: "Changed" } });
});

test("two checkouts reach the shared-lock checkpoint together", async () => {
  await add(id.a, id.p1, 1); await add(id.b, id.p1, 1);
  let release;
  let resolveBoth;
  let count = 0;
  const bothReached = new Promise((resolve) => { resolveBoth = resolve; });
  const releasePromise = new Promise((resolve) => { release = resolve; });
  const hook = async () => { count += 1; if (count === 2) resolveBoth(); await releasePromise; };
  const first = new CheckoutService(new CheckoutRepository({ afterSharedLocks: hook })).checkout(id.a, { addressId: id.aa }, "key-shared-a");
  const second = new CheckoutService(new CheckoutRepository({ afterSharedLocks: hook })).checkout(id.b, { addressId: id.ba }, "key-shared-b");
  await bothReached;
  assert.equal(count, 2);
  release();
  const results = await Promise.all([first, second]);
  assert.equal(results.length, 2);
  assert.equal(await prisma.inventory.count({ where: { productId: id.p1 } }), 1);
});

test("overlapping multi-inventory checkouts use a deterministic lock order", async () => {
  await add(id.a, id.p1, 1); await add(id.a, id.p2, 1); await add(id.a, id.p3, 1);
  await add(id.b, id.p2, 1); await add(id.b, id.p3, 1); await add(id.b, id.p4, 1);
  const first = new CheckoutService().checkout(id.a, { addressId: id.aa }, "key-multi-a");
  const second = new CheckoutService().checkout(id.b, { addressId: id.ba }, "key-multi-b");
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("checkout deadlock timeout")), 3000));
  const results = await Promise.race([Promise.all([first, second]), timeout]);
  assert.equal(results.length, 2);
  const inventories = await prisma.inventory.findMany({ where: { productId: { in: productIds } }, orderBy: { id: "asc" } });
  assert.equal(inventories.filter((inventory) => inventory.reservedQuantity === 2).length, 2);
});

test("persists the idempotency record and replays the exact JSON result", async () => {
  await add(id.a, id.p1, 1);
  const first = await call(checkout, id.a, id.aa, "key-replay");
  const stored = await prisma.idempotencyKey.findFirst({ where: { userId: id.a, operation: "CHECKOUT_V1", key: "key-replay" } });
  assert.equal(stored.status, "COMPLETED"); assert.equal(stored.orderId, first.result.id); assert.deepEqual(stored.result, first.result); assert.ok(stored.completedAt); assert.ok(stored.expiresAt > new Date());
  const replay = await call(checkout, id.a, id.aa, "key-replay");
  assert.equal(replay.replayed, true); assert.deepEqual(replay.result, first.result);
  assert.equal(await prisma.order.count({ where: { customerId: id.ap } }), 1);
  assert.equal(await prisma.inventoryReservation.count({ where: { inventory: { productId: id.p1 } } }), 1);
  await prisma.product.update({ where: { id: id.p1 }, data: { priceInCents: 9999 } });
  assert.deepEqual((await call(checkout, id.a, id.aa, "key-replay")).result, first.result);
});

test("rejects fingerprint changes, invalid keys and protected body fields", async () => {
  await add(id.a, id.p1, 1); await call(checkout, id.a, id.aa, "key-fingerprint");
  await assert.rejects(() => call(checkout, id.a, id.ba, "key-fingerprint"), /different request/i);
  await assert.rejects(() => checkout.checkout(id.a, { addressId: id.aa }, ""), /Idempotency-Key/);
  await assert.rejects(() => checkout.checkout(id.a, { addressId: id.aa }, "x".repeat(256)), /Idempotency-Key/);
  await assert.rejects(() => checkout.checkout(id.a, { addressId: id.aa, orderId: "forbidden" }, "key-body"), /Only addressId/);
});

test("allows the same key for different customers and serializes concurrent duplicates", async () => {
  await add(id.a, id.p1, 1); await add(id.b, id.p1, 1);
  const differentUsers = await Promise.all([call(checkout, id.a, id.aa, "same-key"), call(checkout, id.b, id.ba, "same-key")]);
  assert.equal(new Set(differentUsers.map((item) => item.result.id)).size, 2);
  await setup(); await add(id.a, id.p1, 1);
  const concurrent = await Promise.all([call(checkout, id.a, id.aa, "same-concurrent-key"), call(checkout, id.a, id.aa, "same-concurrent-key")]);
  assert.equal(new Set(concurrent.map((item) => item.result.id)).size, 1); assert.equal(concurrent.filter((item) => item.replayed).length, 1);
  assert.equal(await prisma.order.count({ where: { customerId: id.ap } }), 1);
});

test("failed checkout rolls back the key and permits a retry", async () => {
  await add(id.a, id.p1, 1);
  let failed = true;
  const repository = new CheckoutRepository({ afterFirstOrderItem: async () => { if (failed) { failed = false; throw new Error("forced failure"); } } });
  await assert.rejects(() => new CheckoutService(repository).checkout(id.a, { addressId: id.aa }, "retry-key"), /forced failure/);
  assert.equal(await prisma.idempotencyKey.count({ where: { userId: id.a, key: "retry-key" } }), 0);
  const retry = await call(new CheckoutService(repository), id.a, id.aa, "retry-key");
  assert.equal(retry.replayed, false); assert.equal(await prisma.order.count({ where: { customerId: id.ap } }), 1);
});

test("an existing PROCESSING key returns conflict without recalculating", async () => {
  const fingerprint = createHash("sha256").update(JSON.stringify({ addressId: id.aa })).digest("hex");
  await prisma.idempotencyKey.create({ data: { userId: id.a, operation: "CHECKOUT_V1", key: "processing-key", requestFingerprint: fingerprint, status: "PROCESSING", expiresAt: new Date(Date.now() + 86400000) } });
  await assert.rejects(() => call(checkout, id.a, id.aa, "processing-key"), /processing/i);
  assert.equal(await prisma.order.count({ where: { customerId: id.ap } }), 0);
});
