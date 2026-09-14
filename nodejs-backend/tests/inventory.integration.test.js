const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { PrismaClient, InventoryMovementType } = require("@prisma/client");

const {
  InventoryForbiddenError,
  InventoryService,
} = require("../dist/services/inventoryService.js");
const { InventoryRepository } = require("../dist/repositories/inventoryRepository.js");
const { ConflictError, ObjectNotFoundError, ValidationError } = require("../dist/utils/customErrors.js");

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://marketplace_dev:marketplace_dev_password@localhost:5433/marketplace_dev";
const databaseUrl = new URL(DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(databaseUrl.hostname) ||
  databaseUrl.port !== "5433" ||
  databaseUrl.pathname !== "/marketplace_dev"
) {
  throw new Error("Inventory tests require localhost:5433/marketplace_dev");
}
process.env.DATABASE_URL = DATABASE_URL;

const prisma = new PrismaClient();
const repository = new InventoryRepository();
const service = new InventoryService(repository);
const IDS = {
  ownerUser: "30000000-0000-0000-0000-000000000001",
  ownerSeller: "30000000-0000-0000-0000-000000000002",
  ownerProduct: "30000000-0000-0000-0000-000000000003",
  ownerInventory: "30000000-0000-0000-0000-000000000004",
  otherUser: "30000000-0000-0000-0000-000000000005",
  otherSeller: "30000000-0000-0000-0000-000000000006",
  otherProduct: "30000000-0000-0000-0000-000000000007",
  otherInventory: "30000000-0000-0000-0000-000000000008",
  inactiveUser: "30000000-0000-0000-0000-000000000009",
  inactiveSeller: "30000000-0000-0000-0000-000000000010",
  inactiveProduct: "30000000-0000-0000-0000-000000000011",
  inactiveInventory: "30000000-0000-0000-0000-000000000012",
  inactiveProductOnly: "30000000-0000-0000-0000-000000000013",
  inactiveProductOnlyInventory: "30000000-0000-0000-0000-000000000014",
};
const inventoryIds = [IDS.ownerInventory, IDS.otherInventory, IDS.inactiveInventory, IDS.inactiveProductOnlyInventory];
const productIds = [IDS.ownerProduct, IDS.otherProduct, IDS.inactiveProduct, IDS.inactiveProductOnly];
const sellerIds = [IDS.ownerSeller, IDS.otherSeller, IDS.inactiveSeller];
const userIds = [IDS.ownerUser, IDS.otherUser, IDS.inactiveUser];
const owner = { id: IDS.ownerUser, role: "SELLER" };
const otherSeller = { id: IDS.otherUser, role: "SELLER" };
const admin = { id: "seed-admin-not-used", role: "ADMIN" };
const customer = { id: IDS.ownerUser, role: "CUSTOMER" };

async function cleanup() {
  await prisma.inventoryMovement.deleteMany({ where: { inventoryId: { in: inventoryIds } } });
  await prisma.inventory.deleteMany({ where: { id: { in: inventoryIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixtures() {
  await prisma.user.createMany({
    data: userIds.map((id, index) => ({
      id,
      name: `Inventory Test User ${index}`,
      email: `inventory-test-${index}@local.invalid`,
      normalizedEmail: `inventory-test-${index}@local.invalid`,
      password: "not-a-real-password",
      role: "SELLER",
    })),
  });
  await prisma.seller.createMany({
    data: [
      { id: IDS.ownerSeller, userId: IDS.ownerUser, storeName: "Inventory Owner Store" },
      { id: IDS.otherSeller, userId: IDS.otherUser, storeName: "Inventory Other Store" },
      { id: IDS.inactiveSeller, userId: IDS.inactiveUser, storeName: "Inventory Inactive Store", isActive: false },
    ],
  });
  await prisma.product.createMany({
    data: [
      { id: IDS.ownerProduct, sellerId: IDS.ownerSeller, name: "Inventory Owner Product", reference: "INVENTORY-OWNER", priceInCents: 1000, category: "OFFICE", currency: "BRL" },
      { id: IDS.otherProduct, sellerId: IDS.otherSeller, name: "Inventory Other Product", reference: "INVENTORY-OTHER", priceInCents: 1000, category: "OFFICE", currency: "BRL" },
      { id: IDS.inactiveProduct, sellerId: IDS.inactiveSeller, name: "Inventory Inactive Seller Product", reference: "INVENTORY-INACTIVE-SELLER", priceInCents: 1000, category: "OFFICE", currency: "BRL" },
      { id: IDS.inactiveProductOnly, sellerId: IDS.ownerSeller, name: "Inventory Inactive Product", reference: "INVENTORY-INACTIVE-PRODUCT", priceInCents: 1000, category: "OFFICE", currency: "BRL", isActive: false },
    ],
  });
  await prisma.inventory.createMany({
    data: [
      { id: IDS.ownerInventory, productId: IDS.ownerProduct, onHandQuantity: 10, reservedQuantity: 3 },
      { id: IDS.otherInventory, productId: IDS.otherProduct, onHandQuantity: 10, reservedQuantity: 0 },
      { id: IDS.inactiveInventory, productId: IDS.inactiveProduct, onHandQuantity: 10, reservedQuantity: 0 },
      { id: IDS.inactiveProductOnlyInventory, productId: IDS.inactiveProductOnly, onHandQuantity: 10, reservedQuantity: 0 },
    ],
  });
}

async function resetState() {
  await prisma.inventoryMovement.deleteMany({ where: { inventoryId: { in: inventoryIds } } });
  await prisma.inventory.update({ where: { id: IDS.ownerInventory }, data: { onHandQuantity: 10, reservedQuantity: 3 } });
  await prisma.inventory.update({ where: { id: IDS.otherInventory }, data: { onHandQuantity: 10, reservedQuantity: 0 } });
  await prisma.inventory.update({ where: { id: IDS.inactiveInventory }, data: { onHandQuantity: 10, reservedQuantity: 0 } });
  await prisma.inventory.update({ where: { id: IDS.inactiveProductOnlyInventory }, data: { onHandQuantity: 10, reservedQuantity: 0 } });
  await prisma.seller.update({ where: { id: IDS.inactiveSeller }, data: { isActive: false } });
  await prisma.product.update({ where: { id: IDS.inactiveProduct }, data: { isActive: true } });
  await prisma.product.update({ where: { id: IDS.inactiveProductOnly }, data: { isActive: false } });
}

before(async () => {
  await cleanup();
  await createFixtures();
});

beforeEach(resetState);

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("seller can restock own product and creates RESTOCK movement", async () => {
  const result = await service.restock(IDS.ownerProduct, owner, { quantity: 5, reason: "Initial replenishment" });
  assert.deepEqual(result, { productId: IDS.ownerProduct, onHandQuantity: 15, reservedQuantity: 3, availableQuantity: 12 });
  const movement = await prisma.inventoryMovement.findFirst({ where: { inventoryId: IDS.ownerInventory } });
  assert.equal(movement.movementType, InventoryMovementType.RESTOCK);
  assert.equal(movement.onHandDelta, 5);
  assert.equal(movement.reservedDelta, 0);
  assert.equal(movement.onHandAfter, 15);
  assert.equal(movement.reservedAfter, 3);
});

test("restock does not change reserved quantity", async () => {
  await service.restock(IDS.ownerProduct, owner, { quantity: 2 });
  const inventory = await prisma.inventory.findUnique({ where: { id: IDS.ownerInventory } });
  assert.equal(inventory.reservedQuantity, 3);
});

test("positive adjustment creates MANUAL_CORRECTION", async () => {
  await service.adjust(IDS.ownerProduct, owner, { onHandDelta: 4, reason: "Count correction" });
  const movement = await prisma.inventoryMovement.findFirst({ where: { inventoryId: IDS.ownerInventory } });
  assert.equal(movement.movementType, InventoryMovementType.MANUAL_CORRECTION);
  assert.equal(movement.onHandAfter, 14);
});

test("valid negative adjustment reduces stock", async () => {
  const result = await service.adjust(IDS.ownerProduct, owner, { onHandDelta: -4, reason: "Damaged units" });
  assert.equal(result.onHandQuantity, 6);
  assert.equal(result.availableQuantity, 3);
});

test("rejects zero, decimal and invalid restock quantities", async () => {
  for (const quantity of [0, 1.5, "abc"]) {
    await assert.rejects(() => service.restock(IDS.ownerProduct, owner, { quantity }), ValidationError);
  }
});

test("rejects zero, decimal and missing reasons for adjustments", async () => {
  await assert.rejects(() => service.adjust(IDS.ownerProduct, owner, { onHandDelta: 0, reason: "x" }), ValidationError);
  await assert.rejects(() => service.adjust(IDS.ownerProduct, owner, { onHandDelta: 1.5, reason: "x" }), ValidationError);
  await assert.rejects(() => service.adjust(IDS.ownerProduct, owner, { onHandDelta: 1 }), ValidationError);
});

test("rejects an adjustment below zero or below reserved stock without movement", async () => {
  await assert.rejects(() => service.adjust(IDS.ownerProduct, owner, { onHandDelta: -11, reason: "Invalid removal" }), ConflictError);
  await assert.rejects(() => service.adjust(IDS.ownerProduct, owner, { onHandDelta: -8, reason: "Below reserved" }), ConflictError);
  assert.equal(await prisma.inventoryMovement.count({ where: { inventoryId: IDS.ownerInventory } }), 0);
});

test("rejects another seller and customer", async () => {
  await assert.rejects(() => service.restock(IDS.ownerProduct, otherSeller, { quantity: 1 }), InventoryForbiddenError);
  await assert.rejects(() => service.restock(IDS.ownerProduct, customer, { quantity: 1 }), InventoryForbiddenError);
});

test("admin can operate on an active seller product", async () => {
  const result = await service.restock(IDS.ownerProduct, admin, { quantity: 1 });
  assert.equal(result.onHandQuantity, 11);
});

test("rejects inactive product and inactive seller", async () => {
  await assert.rejects(() => service.restock(IDS.inactiveProductOnly, owner, { quantity: 1 }), ObjectNotFoundError);
  await assert.rejects(() => service.restock(IDS.inactiveProduct, admin, { quantity: 1 }), ObjectNotFoundError);
});

test("returns 404 for a missing product or inventory", async () => {
  await assert.rejects(() => service.getInventory("30000000-0000-0000-0000-000000009999", owner), ObjectNotFoundError);
});

test("returns paginated, descending movement history with consistent after values", async () => {
  await service.restock(IDS.ownerProduct, owner, { quantity: 1, reason: "One" });
  await service.adjust(IDS.ownerProduct, owner, { onHandDelta: -1, reason: "Two" });
  await service.restock(IDS.ownerProduct, owner, { quantity: 2, reason: "Three" });
  const page = await service.listMovements(IDS.ownerProduct, owner, { page: 1, limit: 2 });
  assert.equal(page.pagination.total, 3);
  assert.equal(page.pagination.totalPages, 2);
  assert.equal(page.data.length, 2);
  assert.ok(page.data[0].createdAt >= page.data[1].createdAt || page.data[0].id > page.data[1].id);
  assert.deepEqual(page.data.map((movement) => movement.reservedAfter), [3, 3]);
});

test("a movement creation failure rolls back the inventory update", async () => {
  await assert.rejects(
    () => repository.applyOnHandMovement(IDS.ownerInventory, "INVALID_MOVEMENT_TYPE", 5, "rollback test"),
  );
  const inventory = await prisma.inventory.findUnique({ where: { id: IDS.ownerInventory } });
  assert.equal(inventory.onHandQuantity, 10);
  assert.equal(await prisma.inventoryMovement.count({ where: { inventoryId: IDS.ownerInventory } }), 0);
});

test("concurrent removals cannot consume the same quantity", async () => {
  const results = await Promise.allSettled([
    service.adjust(IDS.ownerProduct, owner, { onHandDelta: -4, reason: "Concurrent one" }),
    service.adjust(IDS.ownerProduct, owner, { onHandDelta: -4, reason: "Concurrent two" }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const inventory = await prisma.inventory.findUnique({ where: { id: IDS.ownerInventory } });
  assert.equal(inventory.onHandQuantity, 6);
  assert.equal(await prisma.inventoryMovement.count({ where: { inventoryId: IDS.ownerInventory } }), 1);
});
