const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { PrismaClient } = require("@prisma/client");
const { OrderService } = require("../dist/services/orderService.js");
const { ObjectNotFoundError, ConflictError } = require("../dist/utils/customErrors.js");

const url = new URL(process.env.TEST_DATABASE_URL || "postgresql://marketplace_dev:marketplace_dev_password@localhost:5433/marketplace_dev");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "5433" || url.pathname !== "/marketplace_dev") throw new Error("Order tests require localhost:5433/marketplace_dev");
process.env.DATABASE_URL = url.toString();
const prisma = new PrismaClient();
const service = new OrderService();
const I = { u1: "91000000-0000-0000-0000-000000000001", c1: "91000000-0000-0000-0000-000000000002", u2: "91000000-0000-0000-0000-000000000003", c2: "91000000-0000-0000-0000-000000000004", su1: "91000000-0000-0000-0000-000000000005", s1: "91000000-0000-0000-0000-000000000006", su2: "91000000-0000-0000-0000-000000000007", s2: "91000000-0000-0000-0000-000000000008", p1: "91000000-0000-0000-0000-000000000009", p2: "91000000-0000-0000-0000-000000000010", o1: "91000000-0000-0000-0000-000000000011", so1: "91000000-0000-0000-0000-000000000012", so2: "91000000-0000-0000-0000-000000000013", i1: "91000000-0000-0000-0000-000000000014", i2: "91000000-0000-0000-0000-000000000015", o2: "91000000-0000-0000-0000-000000000016", so3: "91000000-0000-0000-0000-000000000017", i3: "91000000-0000-0000-0000-000000000018", admin: "91000000-0000-0000-0000-000000000019" };
const all = Object.values(I);

async function clean() {
  await prisma.$transaction(async (tx) => {
    await tx.sellerOrderStatusHistory.deleteMany({ where: { sellerOrderId: { in: [I.so1, I.so2, I.so3] } } });
    await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: [I.o1, I.o2] } } });
    await tx.orderItem.deleteMany({ where: { id: { in: [I.i1, I.i2, I.i3] } } });
    await tx.orderAddress.deleteMany({ where: { orderId: { in: [I.o1, I.o2] } } });
    await tx.sellerOrder.deleteMany({ where: { id: { in: [I.so1, I.so2, I.so3] } } });
    await tx.order.deleteMany({ where: { id: { in: [I.o1, I.o2] } } });
    await tx.inventoryMovement.deleteMany({ where: { inventoryId: { in: [I.p1, I.p2] } } });
    await tx.inventory.deleteMany({ where: { productId: { in: [I.p1, I.p2] } } });
    await tx.product.deleteMany({ where: { id: { in: [I.p1, I.p2] } } });
    await tx.seller.deleteMany({ where: { id: { in: [I.s1, I.s2] } } });
    await tx.customerProfile.deleteMany({ where: { id: { in: [I.c1, I.c2] } } });
    await tx.user.deleteMany({ where: { id: { in: [I.u1, I.u2, I.su1, I.su2, I.admin] } } });
  });
}
async function fixtures() {
  await prisma.$transaction(async (tx) => {
    for (const [id, name, role] of [[I.u1, "Orders Customer 1", "CUSTOMER"], [I.u2, "Orders Customer 2", "CUSTOMER"], [I.su1, "Orders Seller 1", "SELLER"], [I.su2, "Orders Seller 2", "SELLER"], [I.admin, "Orders Admin", "ADMIN"]]) await tx.user.create({ data: { id, name, email: `${id}@orders.local.invalid`, normalizedEmail: `${id}@orders.local.invalid`, password: "test", role } });
    await tx.customerProfile.createMany({ data: [{ id: I.c1, userId: I.u1 }, { id: I.c2, userId: I.u2 }] });
    await tx.seller.createMany({ data: [{ id: I.s1, userId: I.su1, storeName: "Seller One" }, { id: I.s2, userId: I.su2, storeName: "Seller Two" }] });
    await tx.product.createMany({ data: [{ id: I.p1, sellerId: I.s1, name: "Order Product One", priceInCents: 1000, currency: "BRL", category: "OFFICE" }, { id: I.p2, sellerId: I.s2, name: "Order Product Two", priceInCents: 2000, currency: "BRL", category: "BOOKS" }] });
    await tx.inventory.createMany({ data: [{ productId: I.p1, onHandQuantity: 10, reservedQuantity: 0 }, { productId: I.p2, onHandQuantity: 10, reservedQuantity: 0 }] });
    await tx.order.createMany({ data: [{ id: I.o1, customerId: I.c1, status: "CONFIRMED", subtotalInCents: 3000, totalInCents: 3000, currency: "BRL" }, { id: I.o2, customerId: I.c2, status: "CONFIRMED", subtotalInCents: 1000, totalInCents: 1000, currency: "BRL" }] });
    await tx.sellerOrder.createMany({ data: [{ id: I.so1, orderId: I.o1, sellerId: I.s1, status: "CONFIRMED", subtotalInCents: 1000, totalInCents: 1000, currency: "BRL" }, { id: I.so2, orderId: I.o1, sellerId: I.s2, status: "PENDING", subtotalInCents: 2000, totalInCents: 2000, currency: "BRL" }, { id: I.so3, orderId: I.o2, sellerId: I.s1, status: "CONFIRMED", subtotalInCents: 1000, totalInCents: 1000, currency: "BRL" }] });
    await tx.orderItem.createMany({ data: [{ id: I.i1, sellerOrderId: I.so1, productId: I.p1, quantity: 1, unitPriceInCents: 1000, lineTotalInCents: 1000, currency: "BRL", productNameSnapshot: "Order Product One", sellerNameSnapshot: "Seller One" }, { id: I.i2, sellerOrderId: I.so2, productId: I.p2, quantity: 1, unitPriceInCents: 2000, lineTotalInCents: 2000, currency: "BRL", productNameSnapshot: "Order Product Two", sellerNameSnapshot: "Seller Two" }, { id: I.i3, sellerOrderId: I.so3, productId: I.p1, quantity: 1, unitPriceInCents: 1000, lineTotalInCents: 1000, currency: "BRL", productNameSnapshot: "Order Product One", sellerNameSnapshot: "Seller One" }] });
  });
}
before(async () => { await clean(); await fixtures(); });
after(async () => { await clean(); await prisma.$disconnect(); });

test("customer ownership, consolidated detail, pagination and filters", async () => {
  const list = await service.listCustomerOrders(I.u1, {}, 1, 20); assert.equal(list.data.length, 1); assert.equal(list.data[0].totalInCents, 3000); assert.equal(list.pagination.total, 1);
  const detail = await service.getCustomerOrder(I.u1, I.o1); assert.equal(detail.sellerOrders.length, 2); assert.equal(detail.sellerOrders.find((s) => s.sellerId === I.s1).items[0].unitPriceInCents, 1000); assert.equal("totalPrice" in detail, false); assert.equal("orderItems" in detail, false);
  await assert.rejects(() => service.getCustomerOrder(I.u2, I.o1), ObjectNotFoundError);
  const filtered = await service.listCustomerOrders(I.u1, { status: "CONFIRMED" }, 1, 1); assert.equal(filtered.pagination.total, 1); const empty = await service.listCustomerOrders(I.u1, { status: "CANCELLED" }, 1, 20); assert.deepEqual(empty.data, []); assert.equal(empty.pagination.total, 0);
});
test("seller ownership exposes only seller-owned order data", async () => { const list = await service.listSellerOrders(I.su1, {}, 1, 20); assert.equal(list.data.length, 2); assert.ok(list.data.every((x) => x.sellerId === I.s1)); const detail = await service.getSellerOrder(I.su1, I.so1); assert.equal(detail.items.length, 1); await assert.rejects(() => service.getSellerOrder(I.su1, I.so2), ObjectNotFoundError); });
test("valid, invalid and idempotent order transitions", async () => { const actor = { id: I.admin, email: "admin@orders.local.invalid", role: "ADMIN" }; const beforeCount = await prisma.orderStatusHistory.count({ where: { orderId: I.o1 } }); const result = await service.transitionOrder(actor, I.o1, { status: "COMPLETED", reason: "fulfilled" }); assert.equal(result.status, "COMPLETED"); assert.equal(await prisma.orderStatusHistory.count({ where: { orderId: I.o1 } }), beforeCount + 1); await service.transitionOrder(actor, I.o1, { status: "COMPLETED" }); assert.equal(await prisma.orderStatusHistory.count({ where: { orderId: I.o1 } }), beforeCount + 1); await assert.rejects(() => service.transitionOrder(actor, I.o1, { status: "CONFIRMED" }), ConflictError); });
test("concurrent seller transitions have one winner and one history", async () => { const actor = { id: I.su1, email: "seller@orders.local.invalid", role: "SELLER" }; const results = await Promise.allSettled([service.transitionSellerOrder(actor, I.so1, { status: "PROCESSING" }), service.transitionSellerOrder(actor, I.so1, { status: "CANCELLED" })]); assert.equal(results.filter((r) => r.status === "fulfilled").length, 1); assert.equal(await prisma.sellerOrderStatusHistory.count({ where: { sellerOrderId: I.so1 } }), 1); });
test("seller cannot advance while parent awaits payment", async () => { await prisma.sellerOrder.update({ where: { id: I.so2 }, data: { status: "PENDING" } }); await prisma.order.update({ where: { id: I.o1 }, data: { status: "PENDING_PAYMENT" } }); const actor = { id: I.su2, email: "seller2@orders.local.invalid", role: "SELLER" }; await assert.rejects(() => service.transitionSellerOrder(actor, I.so2, { status: "CONFIRMED" }), ConflictError); });
