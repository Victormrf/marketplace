const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { PrismaClient, ProductCategory } = require("@prisma/client");

const { ProductService } = require("../dist/services/productService.js");
const { ProductRepository } = require("../dist/repositories/productRepository.js");
const prismaRepositoryClient = require("../dist/config/db.js").default;
const { ObjectNotFoundError } = require("../dist/utils/customErrors.js");
const { ValidationError } = require("../dist/utils/customErrors.js");
const { readCatalogFilters } = require("../dist/controllers/productController.js");
const {
  parsePaginationValue,
} = require("../dist/types/productRead.js");

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://marketplace_dev:marketplace_dev_password@localhost:5433/marketplace_dev";
const databaseUrl = new URL(DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(databaseUrl.hostname) ||
  databaseUrl.port !== "5433" ||
  databaseUrl.pathname !== "/marketplace_dev"
) {
  throw new Error("Catalog tests require localhost:5433/marketplace_dev");
}
process.env.DATABASE_URL = DATABASE_URL;

const prisma = new PrismaClient();
const service = new ProductService();
const IDS = {
  user: "20000000-0000-0000-0000-000000000001",
  seller: "20000000-0000-0000-0000-000000000002",
  activeProduct: "20000000-0000-0000-0000-000000000003",
  inactiveProduct: "20000000-0000-0000-0000-000000000004",
  inactiveSellerUser: "20000000-0000-0000-0000-000000000005",
  inactiveSeller: "20000000-0000-0000-0000-000000000006",
  inactiveSellerProduct: "20000000-0000-0000-0000-000000000007",
  activeInventory: "20000000-0000-0000-0000-000000000008",
  review: "20000000-0000-0000-0000-000000000009",
  unavailableProduct: "20000000-0000-0000-0000-000000000010",
  noInventoryProduct: "20000000-0000-0000-0000-000000000011",
  unavailableInventory: "20000000-0000-0000-0000-000000000012",
};

async function createFixtures() {
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: IDS.user,
        name: "Catalog Read Test Seller",
        email: "catalog-read-seller@local.invalid",
        normalizedEmail: "catalog-read-seller@local.invalid",
        password: "not-a-real-password",
        role: "SELLER",
      },
    });
    await tx.seller.create({
      data: {
        id: IDS.seller,
        userId: IDS.user,
        storeName: "Catalog Read Test Store",
      },
    });
    await tx.user.create({
      data: {
        id: IDS.inactiveSellerUser,
        name: "Inactive Catalog Seller",
        email: "catalog-read-inactive-seller@local.invalid",
        normalizedEmail: "catalog-read-inactive-seller@local.invalid",
        password: "not-a-real-password",
        role: "SELLER",
      },
    });
    await tx.seller.create({
      data: {
        id: IDS.inactiveSeller,
        userId: IDS.inactiveSellerUser,
        storeName: "Inactive Catalog Store",
        isActive: false,
      },
    });
    await tx.product.createMany({
      data: [
        {
          id: IDS.activeProduct,
          sellerId: IDS.seller,
          name: "Catalog Read Active Product",
          reference: "CATALOG-READ-ACTIVE",
          description: "Deterministic catalog read fixture",
          priceInCents: 1234,
          currency: "BRL",
          category: ProductCategory.ELECTRONICS,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          id: IDS.inactiveProduct,
          sellerId: IDS.seller,
          name: "Catalog Read Inactive Product",
          reference: "CATALOG-READ-INACTIVE",
          priceInCents: 2222,
          currency: "BRL",
          category: ProductCategory.ELECTRONICS,
          isActive: false,
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: IDS.inactiveSellerProduct,
          sellerId: IDS.inactiveSeller,
          name: "Catalog Read Inactive Seller Product",
          reference: "CATALOG-READ-INACTIVE-SELLER",
          priceInCents: 3333,
          currency: "BRL",
          category: ProductCategory.ELECTRONICS,
          createdAt: new Date("2026-01-03T00:00:00.000Z"),
        },
        {
          id: IDS.unavailableProduct,
          sellerId: IDS.seller,
          name: "Catalog Read Unavailable Product",
          reference: "CATALOG-READ-UNAVAILABLE",
          priceInCents: 4444,
          currency: "BRL",
          category: ProductCategory.ELECTRONICS,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        },
        {
          id: IDS.noInventoryProduct,
          sellerId: IDS.seller,
          name: "Catalog Read No Inventory Product",
          reference: "CATALOG-READ-NO-INVENTORY",
          priceInCents: 5555,
          currency: "BRL",
          category: ProductCategory.ELECTRONICS,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      ],
    });
    await tx.inventory.create({
      data: {
        id: IDS.activeInventory,
        productId: IDS.activeProduct,
        onHandQuantity: 10,
        reservedQuantity: 3,
      },
    });
    await tx.inventory.create({
      data: {
        id: IDS.unavailableInventory,
        productId: IDS.unavailableProduct,
        onHandQuantity: 2,
        reservedQuantity: 2,
      },
    });
    await tx.review.create({
      data: {
        id: IDS.review,
        userId: "00000000-0000-0000-0000-000000000002",
        productId: IDS.activeProduct,
        rating: 4,
      },
    });
  });
}

async function removeFixtures() {
  await prisma.review.deleteMany({ where: { id: IDS.review } });
  await prisma.inventory.deleteMany({
    where: { id: { in: [IDS.activeInventory, IDS.unavailableInventory] } },
  });
  await prisma.product.deleteMany({
    where: {
      id: {
        in: [
          IDS.activeProduct,
          IDS.inactiveProduct,
          IDS.inactiveSellerProduct,
          IDS.unavailableProduct,
          IDS.noInventoryProduct,
        ],
      },
    },
  });
  await prisma.seller.deleteMany({ where: { id: { in: [IDS.seller, IDS.inactiveSeller] } } });
  await prisma.user.deleteMany({
    where: { id: { in: [IDS.user, IDS.inactiveSellerUser] } },
  });
}

before(async () => {
  await removeFixtures();
  await createFixtures();
});

after(async () => {
  await removeFixtures();
  const residual = await prisma.product.count({
    where: { id: { in: Object.values(IDS) } },
  });
  assert.equal(residual, 0);
  await prisma.$disconnect();
});

test("returns a paginated product collection", async () => {
  const result = await service.listProducts({}, { page: 1, limit: 2 });
  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.limit, 2);
  assert.ok(result.data.length <= 2);
  assert.ok(result.pagination.total >= result.data.length);
});

test("orders the collection deterministically", async () => {
  const first = await service.listProducts({}, { page: 1, limit: 20 });
  const second = await service.listProducts({}, { page: 1, limit: 20 });
  assert.deepEqual(
    first.data.map((product) => product.id),
    second.data.map((product) => product.id)
  );
});

test("calculates available quantity from inventory", async () => {
  const product = await service.getProductReadById(IDS.activeProduct);
  assert.deepEqual(product.inventory, {
    onHandQuantity: 10,
    reservedQuantity: 3,
    availableQuantity: 7,
  });
  assert.equal(product.averageRating, 4);
  assert.equal(product.isAvailable, true);
});

test("returns only products with positive availability", async () => {
  const result = await service.listProducts({ inStock: true }, { page: 1, limit: 100 });
  assert.ok(result.data.length > 0);
  assert.ok(result.data.every((product) => product.inventory.availableQuantity > 0));
});

test("returns only unavailable products, including missing inventory", async () => {
  const result = await service.listProducts(
    { category: ProductCategory.ELECTRONICS, inStock: false },
    { page: 1, limit: 100 }
  );
  assert.deepEqual(
    result.data.map((product) => product.id),
    [IDS.unavailableProduct, IDS.noInventoryProduct]
  );
  assert.ok(result.data.every((product) => product.isAvailable === false));
});

test("treats a product without Inventory as unavailable", async () => {
  const product = await service.getProductReadById(IDS.noInventoryProduct);
  assert.deepEqual(product.inventory, {
    onHandQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
  });
  assert.equal(product.isAvailable, false);
});

test("combines category and availability filters in the database", async () => {
  const result = await service.listProducts(
    { category: ProductCategory.ELECTRONICS, inStock: true },
    { page: 1, limit: 20 }
  );
  assert.deepEqual(result.data.map((product) => product.id), [IDS.activeProduct]);
});

test("combines seller and availability filters", async () => {
  const result = await service.listProducts(
    { sellerId: IDS.seller, inStock: true },
    { page: 1, limit: 100 }
  );
  assert.ok(result.data.some((product) => product.id === IDS.activeProduct));
  assert.ok(!result.data.some((product) => product.id === IDS.unavailableProduct));
});

test("combines search, category and availability filters", async () => {
  const result = await service.listProducts(
    { search: "ACTIVE PRODUCT", category: ProductCategory.ELECTRONICS, inStock: true },
    { page: 1, limit: 20 }
  );
  assert.deepEqual(result.data.map((product) => product.id), [IDS.activeProduct]);
});

test("calculates total and totalPages after filtering", async () => {
  const result = await service.listProducts(
    { category: ProductCategory.ELECTRONICS, inStock: false },
    { page: 1, limit: 1 }
  );
  assert.equal(result.pagination.total, 2);
  assert.equal(result.pagination.totalPages, 2);
});

test("returns a full filtered page even when unavailable items sort first", async () => {
  const result = await service.listProducts(
    { category: ProductCategory.ELECTRONICS, inStock: true },
    { page: 1, limit: 1 }
  );
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, IDS.activeProduct);
});

test("pushes availability and pagination into repository queries without loading product IDs", async () => {
  const repository = new ProductRepository();
  const originalCount = prismaRepositoryClient.product.count;
  const originalFindMany = prismaRepositoryClient.product.findMany;
  const originalQueryRaw = prismaRepositoryClient.$queryRaw;
  let countArgs;
  let findManyArgs;

  prismaRepositoryClient.$queryRaw = async () => {
    throw new Error("A global inventory ID query must not be executed");
  };
  prismaRepositoryClient.product.count = async (args) => {
    countArgs = args;
    return 1;
  };
  prismaRepositoryClient.product.findMany = async (args) => {
    findManyArgs = args;
    return [];
  };

  try {
    await repository.count({
      search: "keyboard",
      category: ProductCategory.ELECTRONICS,
      sellerId: IDS.seller,
      inStock: true,
    });
    await repository.findMany(
      {
        search: "keyboard",
        category: ProductCategory.ELECTRONICS,
        sellerId: IDS.seller,
        inStock: true,
      },
      4,
      2
    );
  } finally {
    prismaRepositoryClient.product.count = originalCount;
    prismaRepositoryClient.product.findMany = originalFindMany;
    prismaRepositoryClient.$queryRaw = originalQueryRaw;
  }

  assert.ok(countArgs.where.AND.some((condition) => condition.inventory));
  assert.ok(findManyArgs.where.AND.some((condition) => condition.inventory));
  assert.equal(findManyArgs.skip, 4);
  assert.equal(findManyArgs.take, 2);
});

test("rejects invalid inStock values as bad request input", () => {
  assert.throws(() => readCatalogFilters({ inStock: "yes" }), ValidationError);
});

test("returns monetary values in cents and BRL", async () => {
  const product = await service.getProductReadById(IDS.activeProduct);
  assert.equal(product.priceInCents, 1234);
  assert.equal(product.currency, "BRL");
});

test("does not expose legacy price or stock fields", async () => {
  const product = await service.getProductReadById(IDS.activeProduct);
  assert.equal("price" in product, false);
  assert.equal("stock" in product, false);
});

test("excludes inactive products", async () => {
  const result = await service.getProductsReadByIds(
    [IDS.activeProduct, IDS.inactiveProduct],
    { page: 1, limit: 20 }
  );
  assert.deepEqual(result.data.map((product) => product.id), [IDS.activeProduct]);
});

test("excludes products belonging to inactive sellers", async () => {
  const result = await service.getProductsReadByIds(
    [IDS.activeProduct, IDS.inactiveSellerProduct],
    { page: 1, limit: 20 }
  );
  assert.deepEqual(result.data.map((product) => product.id), [IDS.activeProduct]);
});

test("returns 404 semantics for an inactive product detail", async () => {
  await assert.rejects(
    () => service.getProductReadById(IDS.inactiveProduct),
    ObjectNotFoundError
  );
});

test("supports case-insensitive name search", async () => {
  const search = await service.searchProductsRead("ACTIVE PRODUCT", { page: 1, limit: 20 });
  assert.ok(search.data.some((product) => product.id === IDS.activeProduct));
});

test("supports uppercase category filtering", async () => {
  const category = await service.getProductsReadByCategory(ProductCategory.ELECTRONICS, {
    page: 1,
    limit: 20,
  });
  assert.ok(category.data.some((product) => product.id === IDS.activeProduct));
});

test("returns an empty collection with HTTP-collection semantics", async () => {
  const empty = await service.searchProductsRead("no-such-catalog-read-product", {
    page: 1,
    limit: 20,
  });
  assert.deepEqual(empty.data, []);
  assert.equal(empty.pagination.total, 0);
});

test("rejects invalid page and limit values", async () => {
  assert.throws(() => parsePaginationValue("0", 1, "page"), /Invalid page/);
  assert.throws(() => parsePaginationValue("101", 20, "limit"), /Invalid limit/);
  assert.throws(() => parsePaginationValue("nope", 1, "page"), /Invalid page/);
});

test("loads ratings with one aggregate operation for a collection", async () => {
  let aggregateCalls = 0;
  const fakeProduct = {
    id: IDS.activeProduct,
    sellerId: IDS.seller,
    name: "Fake Product",
    reference: null,
    description: null,
    priceInCents: 100,
    currency: "BRL",
    category: ProductCategory.ELECTRONICS,
    image: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    seller: { storeName: "Fake Store" },
    inventory: null,
  };
  const fakeRepository = {
    count: async () => 1,
    findMany: async () => [fakeProduct],
    findById: async () => fakeProduct,
    averageRatings: async () => {
      aggregateCalls += 1;
      return new Map([[IDS.activeProduct, 5]]);
    },
  };
  const isolatedService = new ProductService(fakeRepository);
  const result = await isolatedService.listProducts({}, { page: 1, limit: 20 });
  assert.equal(aggregateCalls, 1);
  assert.equal(result.data[0].averageRating, 5);
  assert.deepEqual(result.data[0].inventory, {
    onHandQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
  });
});
