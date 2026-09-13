const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { PrismaClient, ProductCategory } = require("@prisma/client");

const { ProductService, ProductForbiddenError } = require("../dist/services/productService.js");
const { ProductRepository } = require("../dist/repositories/productRepository.js");
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
  throw new Error("Catalog write tests require localhost:5433/marketplace_dev");
}
process.env.DATABASE_URL = DATABASE_URL;

const prisma = new PrismaClient();
const repository = new ProductRepository();
const service = new ProductService(repository);
const sellerA = { id: "00000000-0000-0000-0000-000000000003", role: "SELLER" };
const sellerB = { id: "00000000-0000-0000-0000-000000000004", role: "SELLER" };
const admin = { id: "00000000-0000-0000-0000-000000000001", role: "ADMIN" };
const TEST_REFERENCE_PREFIX = "STEP2-WRITE-";

async function cleanup() {
  const products = await prisma.product.findMany({
    where: { reference: { startsWith: TEST_REFERENCE_PREFIX } },
    select: { id: true },
  });
  const productIds = products.map((product) => product.id);
  if (!productIds.length) return;
  await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
}

const createInput = (reference) => ({
  name: "Step 2 Write Product",
  reference,
  description: "Deterministic write test product",
  priceInCents: 2599,
  currency: "BRL",
  category: ProductCategory.OFFICE,
  image: null,
});

before(async () => {
  await cleanup();
});

beforeEach(async () => {
  await cleanup();
});

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("creates a valid product for the authenticated seller", async () => {
  const product = await service.createProduct(sellerA, createInput(`${TEST_REFERENCE_PREFIX}VALID`));
  assert.equal(product.sellerId, "00000000-0000-0000-0000-000000000301");
  assert.equal(product.priceInCents, 2599);
  assert.equal(product.category, ProductCategory.OFFICE);
});

test("creates an empty inventory atomically", async () => {
  const product = await service.createProduct(sellerA, createInput(`${TEST_REFERENCE_PREFIX}INVENTORY`));
  assert.deepEqual(product.inventory, {
    onHandQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
  });
});

test("keeps the price in integer cents", async () => {
  const product = await service.createProduct(sellerA, createInput(`${TEST_REFERENCE_PREFIX}CENTS`));
  assert.equal(product.priceInCents, 2599);
  assert.equal(product.currency, "BRL");
});

test("rejects legacy price, stock and sellerId fields", async () => {
  await assert.rejects(
    () => service.createProduct(sellerA, { ...createInput(`${TEST_REFERENCE_PREFIX}LEGACY`), price: 10 }),
    ValidationError
  );
  await assert.rejects(
    () => service.createProduct(sellerA, { ...createInput(`${TEST_REFERENCE_PREFIX}STOCK`), stock: 10 }),
    ValidationError
  );
  await assert.rejects(
    () => service.createProduct(sellerA, { ...createInput(`${TEST_REFERENCE_PREFIX}BODY-SELLER`), sellerId: "other" }),
    ValidationError
  );
});

test("rejects invalid categories", async () => {
  await assert.rejects(
    () => service.createProduct(sellerA, { ...createInput(`${TEST_REFERENCE_PREFIX}CATEGORY`), category: "Eletronics" }),
    ValidationError
  );
});

test("rejects negative and decimal prices", async () => {
  await assert.rejects(
    () => service.createProduct(sellerA, { ...createInput(`${TEST_REFERENCE_PREFIX}NEGATIVE`), priceInCents: -1 }),
    ValidationError
  );
  await assert.rejects(
    () => service.createProduct(sellerA, { ...createInput(`${TEST_REFERENCE_PREFIX}DECIMAL`), priceInCents: 10.5 }),
    ValidationError
  );
});

test("rejects a duplicate reference for the same seller", async () => {
  const reference = `${TEST_REFERENCE_PREFIX}DUPLICATE`;
  await service.createProduct(sellerA, createInput(reference));
  await assert.rejects(() => service.createProduct(sellerA, createInput(reference)), ConflictError);
});

test("allows the same reference for different sellers", async () => {
  const reference = `${TEST_REFERENCE_PREFIX}CROSS-SELLER`;
  const first = await service.createProduct(sellerA, createInput(reference));
  const second = await service.createProduct(sellerB, createInput(reference));
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.sellerId, second.sellerId);
});

test("updates only whitelisted commercial fields", async () => {
  const product = await service.createProduct(sellerA, createInput(`${TEST_REFERENCE_PREFIX}UPDATE`));
  const updated = await service.updateProduct(product.id, sellerA, {
    name: "Updated Step 2 Product",
    priceInCents: 3000,
    description: "Updated description",
    category: ProductCategory.SPORTS,
  });
  assert.equal(updated.name, "Updated Step 2 Product");
  assert.equal(updated.priceInCents, 3000);
  assert.equal(updated.category, ProductCategory.SPORTS);
  assert.equal(updated.inventory.onHandQuantity, 0);
});

test("rejects protected update fields", async () => {
  const product = await service.createProduct(sellerA, createInput(`${TEST_REFERENCE_PREFIX}PROTECTED`));
  await assert.rejects(
    () => service.updateProduct(product.id, sellerA, { sellerId: "other" }),
    ValidationError
  );
  await assert.rejects(
    () => service.updateProduct(product.id, sellerA, { stock: 10 }),
    ValidationError
  );
  await assert.rejects(
    () => service.updateProduct(product.id, sellerA, { isActive: false }),
    ValidationError
  );
});

test("prevents a seller from updating another seller's product", async () => {
  const product = await service.createProduct(sellerA, createInput(`${TEST_REFERENCE_PREFIX}OWNERSHIP-UPDATE`));
  await assert.rejects(
    () => service.updateProduct(product.id, sellerB, { name: "Not allowed" }),
    ProductForbiddenError
  );
});

test("prevents a seller from deactivating another seller's product", async () => {
  const product = await service.createProduct(sellerA, createInput(`${TEST_REFERENCE_PREFIX}OWNERSHIP-DEACTIVATE`));
  await assert.rejects(() => service.deactivateProduct(product.id, sellerB), ProductForbiddenError);
});

test("prevents another seller from deactivating an already inactive product", async () => {
  const product = await service.createProduct(sellerA, createInput(`${TEST_REFERENCE_PREFIX}INACTIVE-OWNERSHIP`));
  await service.deactivateProduct(product.id, sellerA);
  await assert.rejects(() => service.deactivateProduct(product.id, sellerB), ProductForbiddenError);
});

test("allows an admin to deactivate a product", async () => {
  const product = await service.createProduct(sellerA, createInput(`${TEST_REFERENCE_PREFIX}ADMIN-DEACTIVATE`));
  await service.deactivateProduct(product.id, admin);
  const storedProduct = await prisma.product.findUnique({ where: { id: product.id }, select: { isActive: true } });
  assert.equal(storedProduct.isActive, false);
});

test("rejects deactivation by an unauthorized role", async () => {
  const product = await service.createProduct(sellerA, createInput(`${TEST_REFERENCE_PREFIX}ROLE-DEACTIVATE`));
  await assert.rejects(
    () => service.deactivateProduct(product.id, { id: sellerA.id, role: "CUSTOMER" }),
    ProductForbiddenError
  );
});

test("returns 404 when deactivating a nonexistent product", async () => {
  await assert.rejects(
    () => service.deactivateProduct("00000000-0000-0000-0000-000000009999", sellerA),
    ObjectNotFoundError
  );
});

test("deactivates logically and keeps product and inventory rows", async () => {
  const product = await service.createProduct(sellerA, createInput(`${TEST_REFERENCE_PREFIX}DEACTIVATE`));
  await service.deactivateProduct(product.id, sellerA);
  const storedProduct = await prisma.product.findUnique({ where: { id: product.id } });
  const storedInventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
  assert.equal(storedProduct.isActive, false);
  assert.ok(storedProduct.deactivatedAt);
  assert.ok(storedInventory);
  await assert.rejects(() => service.getProductReadById(product.id), ObjectNotFoundError);
  await service.deactivateProduct(product.id, sellerA);
});

test("rolls back Product when Inventory creation fails", async () => {
  const reference = `${TEST_REFERENCE_PREFIX}ROLLBACK`;
  await assert.rejects(
    () => repository.createWithInventory({ ...createInput(reference), sellerId: "00000000-0000-0000-0000-000000000301" }, { onHandQuantity: 0, reservedQuantity: 1 })
  );
  assert.equal(await prisma.product.count({ where: { reference } }), 0);
});

test("reuses the authorization record without a duplicate product lookup", async () => {
  let authorizationLookups = 0;
  let deactivationCalls = 0;
  const product = {
    id: "00000000-0000-0000-0000-000000009998",
    sellerId: "seller-record",
    isActive: true,
  };
  const isolatedService = new ProductService({
    findForAuthorization: async () => {
      authorizationLookups += 1;
      return product;
    },
    findActiveSellerByUserId: async () => ({ id: "seller-record" }),
    deactivateProduct: async () => {
      deactivationCalls += 1;
      return product;
    },
  });

  await isolatedService.deactivateProduct(product.id, { id: "seller-user", role: "SELLER" });
  assert.equal(authorizationLookups, 1);
  assert.equal(deactivationCalls, 1);
});
