const assert = require("node:assert/strict");
const test = require("node:test");

const DEFAULT_LOCAL_DATABASE_URL =
  "postgresql://marketplace_dev:marketplace_dev_password@localhost:5433/marketplace_dev";
const DATABASE_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL;

function assertLocalDatabaseTarget(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL/DATABASE_URL must be a valid PostgreSQL URL.");
  }

  const host = url.hostname.toLowerCase();
  const port = url.port;
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (
    !["localhost", "127.0.0.1"].includes(host) ||
    port !== "5433" ||
    database !== "marketplace_dev"
  ) {
    throw new Error(
      `Refusing database tests: expected localhost/127.0.0.1:5433/marketplace_dev, received ${host}:${port || "default"}/${database}.`
    );
  }

  return { host, port, database };
}

const target = assertLocalDatabaseTarget(DATABASE_URL);
process.env.DATABASE_URL = DATABASE_URL;

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const NOW = new Date("2026-02-01T00:00:00.000Z");
const ROLLBACK = Symbol("rollback-test-transaction");

function id(number) {
  return `10000000-0000-0000-0000-${String(number).padStart(12, "0")}`;
}

function email(number) {
  return `schema-test-${number}@local.invalid`;
}

async function inRollbackTransaction(work) {
  try {
    await prisma.$transaction(async (tx) => {
      await work(tx);
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
}

async function createCustomer(tx, base) {
  const userId = id(base);
  const customerId = id(base + 1);

  await tx.user.create({
    data: {
      id: userId,
      name: `Schema Test Customer ${base}`,
      email: email(base),
      normalizedEmail: email(base),
      password: "not-a-real-password-hash",
      role: "CUSTOMER",
      createdAt: NOW,
      updatedAt: NOW,
    },
  });

  await tx.customerProfile.create({
    data: {
      id: customerId,
      userId,
      phone: "+5511000000000",
      createdAt: NOW,
      updatedAt: NOW,
    },
  });

  return { userId, customerId };
}

async function createSellerAndProduct(tx, base) {
  const userId = id(base);
  const sellerId = id(base + 1);
  const productId = id(base + 2);

  await tx.user.create({
    data: {
      id: userId,
      name: `Schema Test Seller ${base}`,
      email: email(base),
      normalizedEmail: email(base),
      password: "not-a-real-password-hash",
      role: "SELLER",
      createdAt: NOW,
      updatedAt: NOW,
    },
  });

  await tx.seller.create({
    data: {
      id: sellerId,
      userId,
      storeName: `Schema Test Store ${base}`,
      createdAt: NOW,
      updatedAt: NOW,
    },
  });

  await tx.product.create({
    data: {
      id: productId,
      sellerId,
      name: `Schema Test Product ${base}`,
      reference: `SCHEMA-TEST-${base}`,
      priceInCents: 100,
      currency: "BRL",
      category: "OFFICE",
      createdAt: NOW,
      updatedAt: NOW,
    },
  });

  return { userId, sellerId, productId };
}

async function createOrderFixture(tx, base) {
  const customer = await createCustomer(tx, base);
  const seller = await createSellerAndProduct(tx, base + 10);
  const orderId = id(base + 20);
  const sellerOrderId = id(base + 21);

  await tx.order.create({
    data: {
      id: orderId,
      customerId: customer.customerId,
      status: "CONFIRMED",
      subtotalInCents: 100,
      shippingInCents: 0,
      taxInCents: 0,
      discountInCents: 0,
      totalInCents: 100,
      currency: "BRL",
      createdAt: NOW,
      updatedAt: NOW,
    },
  });

  await tx.sellerOrder.create({
    data: {
      id: sellerOrderId,
      orderId,
      sellerId: seller.sellerId,
      status: "CONFIRMED",
      subtotalInCents: 100,
      shippingInCents: 0,
      taxInCents: 0,
      discountInCents: 0,
      totalInCents: 100,
      currency: "BRL",
      createdAt: NOW,
      updatedAt: NOW,
    },
  });

  return { customer, seller, orderId, sellerOrderId };
}

test("database target is the protected local development database", () => {
  assert.deepEqual(target, {
    host: target.host,
    port: "5433",
    database: "marketplace_dev",
  });
});

test("accepts one ACTIVE cart and rejects a second ACTIVE cart", async () => {
  await inRollbackTransaction(async (tx) => {
    const customer = await createCustomer(tx, 100);

    await tx.cart.create({
      data: { id: id(110), customerId: customer.customerId, status: "ACTIVE", createdAt: NOW, updatedAt: NOW },
    });

    await assert.rejects(() =>
      tx.cart.create({
        data: { id: id(111), customerId: customer.customerId, status: "ACTIVE", createdAt: NOW, updatedAt: NOW },
      })
    );
  });
});

test("accepts one default active address and rejects a second default active address", async () => {
  await inRollbackTransaction(async (tx) => {
    const customer = await createCustomer(tx, 200);
    const address = {
      customerId: customer.customerId,
      recipientName: "Schema Test Customer",
      postalCode: "01310-100",
      street: "Avenida Paulista",
      number: "100",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      countryCode: "BR",
      isDefault: true,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
    };

    await tx.customerAddress.create({ data: { id: id(210), ...address } });
    await assert.rejects(() =>
      tx.customerAddress.create({ data: { id: id(211), ...address } })
    );
  });
});

test("accepts valid inventory and rejects reserved quantity above on-hand", async () => {
  await inRollbackTransaction(async (tx) => {
    const seller = await createSellerAndProduct(tx, 300);
    await tx.inventory.create({
      data: {
        id: id(310),
        productId: seller.productId,
        onHandQuantity: 5,
        reservedQuantity: 2,
        createdAt: NOW,
        updatedAt: NOW,
      },
    });

    await assert.rejects(() =>
      tx.inventory.update({ where: { id: id(310) }, data: { reservedQuantity: 6 } })
    );
  });
});

test("rejects negative product prices", async () => {
  await inRollbackTransaction(async (tx) => {
    const seller = await createSellerAndProduct(tx, 410);

    await assert.rejects(() =>
      tx.product.create({
        data: {
          id: id(420),
          sellerId: seller.sellerId,
          name: "Negative Price",
          priceInCents: -1,
          currency: "BRL",
          category: "OFFICE",
          createdAt: NOW,
          updatedAt: NOW,
        },
      })
    );
  });
});

test("rejects non-positive cart quantities", async () => {
  await inRollbackTransaction(async (tx) => {
    const customer = await createCustomer(tx, 400);
    const seller = await createSellerAndProduct(tx, 410);

    await tx.cart.create({
      data: { id: id(430), customerId: customer.customerId, status: "ACTIVE", createdAt: NOW, updatedAt: NOW },
    });
    await assert.rejects(() =>
      tx.cartItem.create({
        data: { id: id(431), cartId: id(430), productId: seller.productId, quantity: 0, createdAt: NOW, updatedAt: NOW },
      })
    );
  });
});

test("accepts a coherent OrderItem and rejects an inconsistent line total", async () => {
  await inRollbackTransaction(async (tx) => {
    const fixture = await createOrderFixture(tx, 500);
    const item = {
      sellerOrderId: fixture.sellerOrderId,
      productId: fixture.seller.productId,
      quantity: 2,
      unitPriceInCents: 50,
      lineTotalInCents: 100,
      currency: "BRL",
      productNameSnapshot: "Schema Test Product",
      sellerNameSnapshot: "Schema Test Store",
      createdAt: NOW,
    };

    await tx.orderItem.create({ data: { id: id(530), ...item } });
    await assert.rejects(() =>
      tx.orderItem.create({ data: { id: id(531), ...item, lineTotalInCents: 101 } })
    );
  });
});

test("accepts coherent Order totals and rejects inconsistent totals", async () => {
  await inRollbackTransaction(async (tx) => {
    const customer = await createCustomer(tx, 600);
    const valid = {
      customerId: customer.customerId,
      status: "PENDING_PAYMENT",
      subtotalInCents: 1000,
      shippingInCents: 100,
      taxInCents: 50,
      discountInCents: 25,
      totalInCents: 1125,
      currency: "BRL",
      createdAt: NOW,
      updatedAt: NOW,
    };

    await tx.order.create({ data: { id: id(610), ...valid } });
    await assert.rejects(() =>
      tx.order.create({ data: { id: id(611), ...valid, totalInCents: 1126 } })
    );
  });
});

test("accepts coherent SellerOrder totals and rejects inconsistent totals", async () => {
  await inRollbackTransaction(async (tx) => {
    const customer = await createCustomer(tx, 700);
    const seller = await createSellerAndProduct(tx, 710);
    const order = {
      customerId: customer.customerId,
      status: "PENDING_PAYMENT",
      subtotalInCents: 1000,
      shippingInCents: 100,
      taxInCents: 50,
      discountInCents: 25,
      totalInCents: 1125,
      currency: "BRL",
      createdAt: NOW,
      updatedAt: NOW,
    };
    await tx.order.create({ data: { id: id(720), ...order } });

    const valid = {
      orderId: id(720),
      sellerId: seller.sellerId,
      status: "PENDING",
      subtotalInCents: 1000,
      shippingInCents: 100,
      taxInCents: 50,
      discountInCents: 25,
      totalInCents: 1125,
      currency: "BRL",
      createdAt: NOW,
      updatedAt: NOW,
    };
    await tx.sellerOrder.create({ data: { id: id(730), ...valid } });
    await assert.rejects(() =>
      tx.sellerOrder.create({ data: { id: id(731), ...valid, totalInCents: 1126 } })
    );
  });
});

test("accepts one-target reviews and rejects zero or two targets", async () => {
  await inRollbackTransaction(async (tx) => {
    const customer = await createCustomer(tx, 800);
    const seller = await createSellerAndProduct(tx, 810);

    await tx.review.create({
      data: { id: id(820), userId: customer.userId, productId: seller.productId, rating: 5, createdAt: NOW, updatedAt: NOW },
    });
    await tx.review.create({
      data: { id: id(821), userId: customer.userId, sellerId: seller.sellerId, rating: 4, createdAt: NOW, updatedAt: NOW },
    });
    await assert.rejects(() =>
      tx.review.create({ data: { id: id(822), userId: customer.userId, rating: 5, createdAt: NOW, updatedAt: NOW } })
    );
    await assert.rejects(() =>
      tx.review.create({ data: { id: id(823), userId: customer.userId, productId: seller.productId, sellerId: seller.sellerId, rating: 5, createdAt: NOW, updatedAt: NOW } })
    );
  });
});

test("accepts ratings 1 and 5 and rejects ratings outside that range", async () => {
  await inRollbackTransaction(async (tx) => {
    const customer = await createCustomer(tx, 900);
    const seller = await createSellerAndProduct(tx, 910);
    await tx.review.create({ data: { id: id(920), userId: customer.userId, productId: seller.productId, rating: 1, createdAt: NOW, updatedAt: NOW } });
    await tx.review.create({ data: { id: id(921), userId: customer.userId, sellerId: seller.sellerId, rating: 5, createdAt: NOW, updatedAt: NOW } });

    await assert.rejects(() =>
      tx.review.create({ data: { id: id(922), userId: customer.userId, productId: seller.productId, rating: 0, createdAt: NOW, updatedAt: NOW } })
    );
  });
});

test("rejects duplicate reviews by the same user for the same product and seller", async () => {
  await inRollbackTransaction(async (tx) => {
    const customer = await createCustomer(tx, 1000);
    const seller = await createSellerAndProduct(tx, 1010);

    await tx.review.create({ data: { id: id(1020), userId: customer.userId, productId: seller.productId, rating: 5, createdAt: NOW, updatedAt: NOW } });
    await assert.rejects(() =>
      tx.review.create({ data: { id: id(1021), userId: customer.userId, productId: seller.productId, rating: 4, createdAt: NOW, updatedAt: NOW } })
    );
  });

  await inRollbackTransaction(async (tx) => {
    const customer = await createCustomer(tx, 1100);
    const seller = await createSellerAndProduct(tx, 1110);
    await tx.review.create({ data: { id: id(1022), userId: customer.userId, sellerId: seller.sellerId, rating: 5, createdAt: NOW, updatedAt: NOW } });
    await assert.rejects(() =>
      tx.review.create({ data: { id: id(1123), userId: customer.userId, sellerId: seller.sellerId, rating: 4, createdAt: NOW, updatedAt: NOW } })
    );
  });
});

test.after(async () => {
  await prisma.$disconnect();
});

console.log(`Database test target confirmed: ${target.host}:${target.port}/${target.database}`);
