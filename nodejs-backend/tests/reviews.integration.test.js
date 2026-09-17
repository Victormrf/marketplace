const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");

const url = new URL(
  process.env.TEST_DATABASE_URL ||
    "postgresql://marketplace_dev:marketplace_dev_password@localhost:5433/marketplace_dev",
);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "5433" ||
  url.pathname !== "/marketplace_dev"
) {
  throw new Error("Review tests require localhost:5433/marketplace_dev");
}
process.env.DATABASE_URL = url.toString();
process.env.JWT_SECRET = "reviews-test-secret";

const prisma = new PrismaClient();
const {
  ReviewRepository,
} = require("../dist/repositories/reviewRepository.js");
const { ReviewService } = require("../dist/services/reviewService.js");
const {
  ConflictError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} = require("../dist/utils/customErrors.js");

const ids = {
  user: "97000000-0000-0000-0000-000000000001",
  customer: "97000000-0000-0000-0000-000000000002",
  order: "97000000-0000-0000-0000-000000000003",
  sellerOrder: "97000000-0000-0000-0000-000000000004",
  orderItem: "97000000-0000-0000-0000-000000000005",
  orderingUserOne: "97000000-0000-0000-0000-000000000006",
  orderingUserTwo: "97000000-0000-0000-0000-000000000007",
};

const users = {
  customer: {
    id: ids.user,
    email: "reviews-customer@local.invalid",
    role: "CUSTOMER",
  },
  seller: {
    id: "00000000-0000-0000-0000-000000000003",
    email: "seller.one.seed@local.invalid",
    role: "SELLER",
  },
  admin: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "admin.seed@local.invalid",
    role: "ADMIN",
  },
};

const productId = "00000000-0000-0000-0000-000000000401";
const otherProductId = "00000000-0000-0000-0000-000000000402";
const sellerId = "00000000-0000-0000-0000-000000000301";

async function cleanFixtures() {
  await prisma.review.deleteMany({
    where: {
      userId: {
        in: [ids.user, ids.orderingUserOne, ids.orderingUserTwo],
      },
    },
  });
  await prisma.orderItem.deleteMany({ where: { id: ids.orderItem } });
  await prisma.sellerOrder.deleteMany({ where: { id: ids.sellerOrder } });
  await prisma.order.deleteMany({ where: { id: ids.order } });
  await prisma.customerProfile.deleteMany({ where: { id: ids.customer } });
  await prisma.user.deleteMany({ where: { id: ids.user } });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.orderingUserOne, ids.orderingUserTwo] } },
  });
}

async function createFixtures() {
  await prisma.user.create({
    data: {
      id: ids.user,
      name: "Reviews Customer",
      email: users.customer.email,
      normalizedEmail: users.customer.email,
      password: "development-only",
      role: "CUSTOMER",
    },
  });
  await prisma.user.createMany({
    data: [ids.orderingUserOne, ids.orderingUserTwo].map((id, index) => ({
      id,
      name: `Review Ordering User ${index + 1}`,
      email: `reviews-ordering-${index + 1}@local.invalid`,
      normalizedEmail: `reviews-ordering-${index + 1}@local.invalid`,
      password: "development-only",
      role: "CUSTOMER",
    })),
  });
  await prisma.customerProfile.create({
    data: { id: ids.customer, userId: ids.user },
  });
  await prisma.order.create({
    data: {
      id: ids.order,
      customerId: ids.customer,
      status: "CONFIRMED",
      subtotalInCents: 1250,
      totalInCents: 1250,
      currency: "BRL",
    },
  });
  await prisma.sellerOrder.create({
    data: {
      id: ids.sellerOrder,
      orderId: ids.order,
      sellerId,
      status: "DELIVERED",
      subtotalInCents: 1250,
      totalInCents: 1250,
      currency: "BRL",
    },
  });
  await prisma.orderItem.create({
    data: {
      id: ids.orderItem,
      sellerOrderId: ids.sellerOrder,
      productId,
      quantity: 1,
      unitPriceInCents: 1250,
      lineTotalInCents: 1250,
      currency: "BRL",
      productNameSnapshot: "Review Product",
      sellerNameSnapshot: "Review Seller",
    },
  });
}

before(async () => {
  await cleanFixtures();
  await createFixtures();
});

beforeEach(async () => {
  await prisma.review.deleteMany({
    where: {
      userId: {
        in: [ids.user, ids.orderingUserOne, ids.orderingUserTwo],
      },
    },
  });
});

after(async () => {
  await cleanFixtures();
  await prisma.$disconnect();
});

test("customer can review a delivered product and its seller", async () => {
  const service = new ReviewService();
  const productReview = await service.createProductReview(users.customer, productId, {
    rating: 5,
    comment: "  Excelente produto  ",
  });
  const sellerReview = await service.createSellerReview(users.customer, sellerId, {
    rating: 4,
    comment: "Bom atendimento",
  });

  assert.equal(productReview.productId, productId);
  assert.equal(productReview.sellerId, null);
  assert.equal(productReview.comment, "Excelente produto");
  assert.equal(sellerReview.sellerId, sellerId);
  assert.equal(sellerReview.productId, null);
});

test("reviews require a delivered purchase and a customer role", async () => {
  const service = new ReviewService();
  await assert.rejects(
    () => service.createProductReview(users.customer, otherProductId, { rating: 5 }),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.createProductReview(users.seller, productId, { rating: 5 }),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.createSellerReview(users.admin, sellerId, { rating: 5 }),
    ForbiddenError,
  );
});

test("validates ratings, comments and protected update fields", async () => {
  const service = new ReviewService();
  const review = await service.createProductReview(users.customer, productId, {
    rating: 3,
    comment: "initial",
  });
  await assert.rejects(
    () => service.update(users.customer, review.id, { rating: 6 }),
    ValidationError,
  );
  await assert.rejects(
    () => service.update(users.customer, review.id, { rating: 4, comment: "x".repeat(2001) }),
    ValidationError,
  );
  await assert.rejects(
    () => service.update(users.seller, review.id, { rating: 4 }),
    ForbiddenError,
  );
  const updated = await service.update(users.customer, review.id, {
    rating: 4,
    comment: "   ",
  });
  assert.equal(updated.comment, null);
});

test("PATCH preserves omitted fields and distinguishes null from omission", async () => {
  const service = new ReviewService();
  const review = await service.createProductReview(users.customer, productId, {
    rating: 3,
    comment: "Keep this comment",
  });

  const ratingOnly = await service.update(users.customer, review.id, {
    rating: 4,
  });
  assert.equal(ratingOnly.rating, 4);
  assert.equal(ratingOnly.comment, "Keep this comment");

  const commentOnly = await service.update(users.customer, review.id, {
    comment: "New comment",
  });
  assert.equal(commentOnly.rating, 4);
  assert.equal(commentOnly.comment, "New comment");

  const explicitNull = await service.update(users.customer, review.id, {
    comment: null,
  });
  assert.equal(explicitNull.rating, 4);
  assert.equal(explicitNull.comment, null);
});

test("an undelivered purchase does not authorize a review", async () => {
  const service = new ReviewService();
  await prisma.sellerOrder.update({
    where: { id: ids.sellerOrder },
    data: { status: "CONFIRMED" },
  });
  try {
    await assert.rejects(
      () => service.createProductReview(users.customer, productId, { rating: 5 }),
      ForbiddenError,
    );
  } finally {
    await prisma.sellerOrder.update({
      where: { id: ids.sellerOrder },
      data: { status: "DELIVERED" },
    });
  }
});

test("a delivered purchase from another seller does not authorize that seller review", async () => {
  const service = new ReviewService();
  await assert.rejects(
    () =>
      service.createSellerReview(
        users.customer,
        "00000000-0000-0000-0000-000000000302",
        { rating: 5 },
      ),
    ForbiddenError,
  );
});

test("orders controlled reviews by createdAt DESC and id DESC", async () => {
  const createdAt = new Date("2026-02-01T00:00:00.000Z");
  await prisma.review.createMany({
    data: [
      {
        id: "97000000-0000-0000-0000-000000000101",
        userId: ids.orderingUserOne,
        productId,
        rating: 2,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: "97000000-0000-0000-0000-000000000102",
        userId: ids.orderingUserTwo,
        productId,
        rating: 3,
        createdAt,
        updatedAt: createdAt,
      },
    ],
  });
  const repository = new ReviewRepository();
  const records = await repository.findMany("product", productId, {}, 0, 20);
  const controlled = records.filter((record) =>
    [ids.orderingUserOne, ids.orderingUserTwo].includes(record.userId),
  );
  assert.deepEqual(
    controlled.map((record) => record.id),
    [
      "97000000-0000-0000-0000-000000000102",
      "97000000-0000-0000-0000-000000000101",
    ],
  );
});

test("uniqueness is enforced for sequential and concurrent creations", async () => {
  const service = new ReviewService();
  const first = await service.createProductReview(users.customer, productId, {
    rating: 5,
  });
  await assert.rejects(
    () => service.createProductReview(users.customer, productId, { rating: 4 }),
    ConflictError,
  );
  await prisma.review.delete({ where: { id: first.id } });

  const results = await Promise.allSettled([
    service.createProductReview(users.customer, productId, { rating: 5 }),
    service.createProductReview(users.customer, productId, { rating: 4 }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(
    await prisma.review.count({ where: { userId: ids.user, productId } }),
    1,
  );
});

test("lists reviews with filtered pagination and database aggregation", async () => {
  const service = new ReviewService();
  const beforeProduct = await service.list(
    "product",
    productId,
    { rating: 5 },
    { page: 1, limit: 20 },
  );
  const beforeSeller = await service.list(
    "seller",
    sellerId,
    {},
    { page: 1, limit: 20 },
  );
  await service.createProductReview(users.customer, productId, { rating: 5 });
  await service.createSellerReview(users.customer, sellerId, { rating: 2 });
  const collection = await service.list(
    "product",
    productId,
    { rating: 5 },
    { page: 1, limit: 20 },
  );
  assert.equal(collection.pagination.total, beforeProduct.pagination.total + 1);
  assert.equal(collection.data.every((review) => review.rating === 5), true);
  assert.equal(
    collection.reputation.totalReviews,
    beforeProduct.reputation.totalReviews + 1,
  );
  assert.equal(
    collection.reputation.distribution["5"],
    beforeProduct.reputation.distribution["5"] + 1,
  );

  const sellerCollection = await service.list(
    "seller",
    sellerId,
    {},
    { page: 1, limit: 20 },
  );
  assert.equal(
    sellerCollection.pagination.total,
    beforeSeller.pagination.total + 1,
  );
  assert.equal(
    sellerCollection.reputation.totalReviews,
    beforeSeller.reputation.totalReviews + 1,
  );

  const empty = await service.list(
    "seller",
    "97000000-0000-0000-0000-000000000099",
    {},
    { page: 1, limit: 20 },
  );
  assert.deepEqual(empty.data, []);
  assert.equal(empty.pagination.totalPages, 0);
});

test("HTTP uses resource routes and disables the legacy deletion route", async () => {
  const { app } = require("../dist/server.js");
  const server = app.listen(0);
  const port = server.address().port;
  const token = jwt.sign({ sub: ids.user }, process.env.JWT_SECRET);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/products/${productId}/reviews`);
    assert.equal(response.status, 200);
    const legacy = await fetch(`http://127.0.0.1:${port}/review/product/${productId}`);
    assert.equal(legacy.status, 404);
    for (const [path, field] of [
      [`/products/${productId}/reviews`, "userId"],
      [`/products/${productId}/reviews`, "productId"],
      [`/sellers/${sellerId}/reviews`, "sellerId"],
    ]) {
      const invalid = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rating: 5, [field]: ids.user }),
      });
      assert.equal(invalid.status, 400);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
