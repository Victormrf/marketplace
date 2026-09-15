const test = require("node:test");
const assert = require("node:assert/strict");
const { PrismaClient, UserRole, ProductCategory, Currency } = require("@prisma/client");
const { CartService } = require("../dist/services/cartService");

function targetIsLocal() {
  const url = new URL(process.env.DATABASE_URL || "");
  return ["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "5433" && url.pathname === "/marketplace_dev";
}
if (!targetIsLocal()) throw new Error("test:cart requires localhost:5433/marketplace_dev");

const prisma = new PrismaClient();
const service = new CartService();
const ids = {
  customer: "76000000-0000-0000-0000-000000000001",
  customerProfile: "76000000-0000-0000-0000-000000000002",
  otherCustomer: "76000000-0000-0000-0000-000000000003",
  otherProfile: "76000000-0000-0000-0000-000000000004",
  sellerUser: "76000000-0000-0000-0000-000000000005",
  seller: "76000000-0000-0000-0000-000000000006",
  admin: "76000000-0000-0000-0000-000000000007",
  product: "76000000-0000-0000-0000-000000000008",
  unavailable: "76000000-0000-0000-0000-000000000009",
  noInventory: "76000000-0000-0000-0000-000000000010",
  inactiveProduct: "76000000-0000-0000-0000-000000000011",
  inactiveSellerUser: "76000000-0000-0000-0000-000000000012",
  inactiveSeller: "76000000-0000-0000-0000-000000000013",
  inactiveSellerProduct: "76000000-0000-0000-0000-000000000014",
};

async function cleanup() {
  await prisma.cartItem.deleteMany({ where: { cart: { customerId: { in: [ids.customerProfile, ids.otherProfile] } } } });
  await prisma.cart.deleteMany({ where: { customerId: { in: [ids.customerProfile, ids.otherProfile] } } });
  await prisma.inventory.deleteMany({ where: { productId: { in: [ids.product, ids.unavailable, ids.noInventory, ids.inactiveProduct, ids.inactiveSellerProduct] } } });
  await prisma.product.deleteMany({ where: { id: { in: [ids.product, ids.unavailable, ids.noInventory, ids.inactiveProduct, ids.inactiveSellerProduct] } } });
  await prisma.seller.deleteMany({ where: { id: { in: [ids.seller, ids.inactiveSeller] } } });
  await prisma.customerProfile.deleteMany({ where: { id: { in: [ids.customerProfile, ids.otherProfile] } } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.customer, ids.otherCustomer, ids.sellerUser, ids.admin, ids.inactiveSellerUser] } } });
}

async function setup() {
  await cleanup();
  await prisma.user.createMany({ data: [
    { id: ids.customer, name: "Cart Customer", email: "step6-cart-customer@local.invalid", normalizedEmail: "step6-cart-customer@local.invalid", password: "hash", role: UserRole.CUSTOMER },
    { id: ids.otherCustomer, name: "Other Customer", email: "step6-cart-other@local.invalid", normalizedEmail: "step6-cart-other@local.invalid", password: "hash", role: UserRole.CUSTOMER },
    { id: ids.sellerUser, name: "Cart Seller", email: "step6-cart-seller@local.invalid", normalizedEmail: "step6-cart-seller@local.invalid", password: "hash", role: UserRole.SELLER },
    { id: ids.admin, name: "Cart Admin", email: "step6-cart-admin@local.invalid", normalizedEmail: "step6-cart-admin@local.invalid", password: "hash", role: UserRole.ADMIN },
    { id: ids.inactiveSellerUser, name: "Inactive Seller", email: "step6-cart-inactive@local.invalid", normalizedEmail: "step6-cart-inactive@local.invalid", password: "hash", role: UserRole.SELLER },
  ] });
  await prisma.customerProfile.createMany({ data: [{ id: ids.customerProfile, userId: ids.customer }, { id: ids.otherProfile, userId: ids.otherCustomer }] });
  await prisma.seller.createMany({ data: [{ id: ids.seller, userId: ids.sellerUser, storeName: "Cart Store" }, { id: ids.inactiveSeller, userId: ids.inactiveSellerUser, storeName: "Inactive Store", isActive: false }] });
  await prisma.product.createMany({ data: [
    { id: ids.product, sellerId: ids.seller, name: "Cart Product", priceInCents: 1250, currency: Currency.BRL, category: ProductCategory.OFFICE },
    { id: ids.unavailable, sellerId: ids.seller, name: "Unavailable Product", priceInCents: 2000, currency: Currency.BRL, category: ProductCategory.OFFICE },
    { id: ids.noInventory, sellerId: ids.seller, name: "No Inventory Product", priceInCents: 3000, currency: Currency.BRL, category: ProductCategory.BOOKS },
    { id: ids.inactiveProduct, sellerId: ids.seller, name: "Inactive Product", priceInCents: 4000, currency: Currency.BRL, category: ProductCategory.TOYS, isActive: false },
    { id: ids.inactiveSellerProduct, sellerId: ids.inactiveSeller, name: "Inactive Seller Product", priceInCents: 5000, currency: Currency.BRL, category: ProductCategory.PETS },
  ] });
  await prisma.inventory.createMany({ data: [{ productId: ids.product, onHandQuantity: 10, reservedQuantity: 2 }, { productId: ids.unavailable, onHandQuantity: 2, reservedQuantity: 2 }, { productId: ids.inactiveProduct, onHandQuantity: 10, reservedQuantity: 0 }, { productId: ids.inactiveSellerProduct, onHandQuantity: 10, reservedQuantity: 0 }] });
}

const actor = (id) => id;
test.before(async () => setup());
test.after(async () => { await cleanup(); await prisma.$disconnect(); });

test("creates and reuses one active cart, including concurrent get-or-create", async () => {
  await prisma.cartItem.deleteMany({ where: { cart: { customerId: ids.customerProfile } } });
  await prisma.cart.deleteMany({ where: { customerId: ids.customerProfile, status: "ACTIVE" } });
  assert.equal(await prisma.cart.count({ where: { customerId: ids.customerProfile, status: "ACTIVE" } }), 0);
  const results = await Promise.all([service.getCart(actor(ids.customer)), service.getCart(actor(ids.customer))]);
  assert.equal(new Set(results.map((cart) => cart.id)).size, 1);
  assert.equal(results.length, 2);
  assert.equal(await prisma.cart.count({ where: { customerId: ids.customerProfile, status: "ACTIVE" } }), 1);
});

test("adds, merges sequentially and concurrently without changing inventory", async () => {
  const before = await prisma.inventory.findUnique({ where: { productId: ids.product } });
  const beforeReservations = await prisma.inventoryReservation.count();
  const beforeMovements = await prisma.inventoryMovement.count();
  await service.addItem(ids.customer, { productId: ids.product, quantity: 2 });
  await service.addItem(ids.customer, { productId: ids.product, quantity: 3 });
  await Promise.all([service.addItem(ids.customer, { productId: ids.product, quantity: 1 }), service.addItem(ids.customer, { productId: ids.product, quantity: 2 })]);
  const cart = await service.getCart(ids.customer);
  assert.equal(cart.items[0].quantity, 8);
  assert.equal(cart.items[0].priceInCents, 1250);
  assert.equal(cart.items[0].lineTotalInCents, 10000);
  assert.equal(cart.totalInCents, 10000);
  assert.deepEqual(await prisma.inventory.findUnique({ where: { productId: ids.product } }), before);
  assert.equal(await prisma.inventoryReservation.count(), beforeReservations);
  assert.equal(await prisma.inventoryMovement.count(), beforeMovements);
});

test("updates, removes, clears idempotently and exposes live availability", async () => {
  await service.updateItem(ids.customer, ids.product, { quantity: 4 });
  let cart = await service.getCart(ids.customer);
  assert.equal(cart.items[0].availableQuantity, 8);
  assert.equal(cart.items[0].hasSufficientStock, true);
  assert.equal(cart.items[0].isAvailable, true);
  await prisma.product.update({ where: { id: ids.product }, data: { isActive: false } });
  cart = await service.getCart(ids.customer);
  assert.equal(cart.items[0].hasSufficientStock, true);
  assert.equal(cart.items[0].isAvailable, false);
  await prisma.product.update({ where: { id: ids.product }, data: { isActive: true } });
  await prisma.seller.update({ where: { id: ids.seller }, data: { isActive: false } });
  cart = await service.getCart(ids.customer);
  assert.equal(cart.items[0].hasSufficientStock, true);
  assert.equal(cart.items[0].isAvailable, false);
  await prisma.seller.update({ where: { id: ids.seller }, data: { isActive: true } });
  await prisma.inventory.delete({ where: { productId: ids.product } });
  cart = await service.getCart(ids.customer);
  assert.equal(cart.items[0].availableQuantity, 0);
  assert.equal(cart.items[0].hasSufficientStock, false);
  assert.equal(cart.items[0].isAvailable, false);
  await prisma.inventory.create({ data: { productId: ids.product, onHandQuantity: 10, reservedQuantity: 2 } });
  await prisma.inventory.update({ where: { productId: ids.product }, data: { onHandQuantity: 5 } });
  cart = await service.getCart(ids.customer);
  assert.equal(cart.items[0].availableQuantity, 3);
  assert.equal(cart.items[0].hasSufficientStock, false);
  assert.equal(cart.items[0].isAvailable, false);
  await service.removeItem(ids.customer, ids.product);
  await service.clear(ids.customer);
  await service.clear(ids.customer);
  assert.deepEqual((await service.getCart(ids.customer)).items, []);
});

test("validates identity, ownership, protected fields and quantities", async () => {
  await assert.rejects(() => service.addItem(ids.sellerUser, { productId: ids.product, quantity: 1 }), /permission/i);
  await assert.rejects(() => service.addItem(ids.admin, { productId: ids.product, quantity: 1 }), /permission/i);
  await assert.rejects(() => service.addItem(ids.customer, { productId: ids.product, quantity: 0 }), /positive integer/i);
  await assert.rejects(() => service.addItem(ids.customer, { productId: ids.product, quantity: 1.5 }), /positive integer/i);
  await assert.rejects(() => service.addItem(ids.customer, { productId: ids.product, quantity: 1, cartId: "forbidden" }), /Unsupported/i);
  await assert.rejects(() => service.addItem(ids.customer, { productId: ids.unavailable, quantity: 1 }), /unavailable|insufficient/i);
  await assert.rejects(() => service.addItem(ids.customer, { productId: ids.noInventory, quantity: 1 }), /unavailable|insufficient/i);
  await assert.rejects(() => service.addItem(ids.customer, { productId: ids.inactiveProduct, quantity: 1 }), /unavailable|insufficient/i);
  await assert.rejects(() => service.addItem(ids.customer, { productId: ids.inactiveSellerProduct, quantity: 1 }), /unavailable|insufficient/i);
});

test("keeps customer ownership isolated and enforces the active-cart unique constraint", async () => {
  await service.addItem(ids.customer, { productId: ids.product, quantity: 1 });
  await assert.rejects(() => service.removeItem(ids.otherCustomer, ids.product), /not found/i);
  await assert.rejects(() => prisma.cart.create({ data: { customerId: ids.customerProfile, status: "ACTIVE" } }));
});
