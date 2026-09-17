const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const {
  DeliveryRepository,
} = require("../dist/repositories/deliveryRepository.js");
const { DeliveryService } = require("../dist/services/deliveryService.js");
const {
  ConflictError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} = require("../dist/utils/customErrors.js");
const { app } = require("../dist/server.js");

const url = new URL(
  process.env.TEST_DATABASE_URL ||
    "postgresql://marketplace_dev:marketplace_dev_password@localhost:5433/marketplace_dev",
);

if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "5433" ||
  url.pathname !== "/marketplace_dev"
) {
  throw new Error("Delivery tests require localhost:5433/marketplace_dev");
}

process.env.DATABASE_URL = url.toString();
process.env.JWT_SECRET = "deliveries-test-secret";

const prisma = new PrismaClient();
const ids = {
  customerUser: "94000000-0000-0000-0000-000000000001",
  customerProfile: "94000000-0000-0000-0000-000000000002",
  adminUser: "94000000-0000-0000-0000-000000000003",
  sellerUser: "94000000-0000-0000-0000-000000000004",
  seller: "94000000-0000-0000-0000-000000000005",
  otherSellerUser: "94000000-0000-0000-0000-000000000006",
  otherSeller: "94000000-0000-0000-0000-000000000007",
  order: "94000000-0000-0000-0000-000000000008",
  sellerOrder: "94000000-0000-0000-0000-000000000009",
  otherSellerOrder: "94000000-0000-0000-0000-000000000010",
};

const users = {
  customer: {
    id: ids.customerUser,
    email: "delivery-customer@local.invalid",
    role: "CUSTOMER",
  },
  admin: {
    id: ids.adminUser,
    email: "delivery-admin@local.invalid",
    role: "ADMIN",
  },
  seller: {
    id: ids.sellerUser,
    email: "delivery-seller@local.invalid",
    role: "SELLER",
  },
  otherSeller: {
    id: ids.otherSellerUser,
    email: "delivery-other-seller@local.invalid",
    role: "SELLER",
  },
};

function batchId(prefix, index) {
  return `${prefix}-0000-0000-0000-${String(index).padStart(12, "0")}`;
}

const batchFixtures = Array.from({ length: 105 }, (_, index) => ({
  userId: batchId("94100000", index + 1),
  sellerId: batchId("94200000", index + 1),
  sellerOrderId: batchId("94300000", index + 1),
  deliveryId: batchId("94400000", index + 1),
}));

async function cleanDeliveries() {
  await prisma.deliveryStatusHistory.deleteMany({
    where: {
      delivery: {
        sellerOrderId: { in: [ids.sellerOrder, ids.otherSellerOrder] },
      },
    },
  });
  await prisma.delivery.deleteMany({
    where: { sellerOrderId: { in: [ids.sellerOrder, ids.otherSellerOrder] } },
  });
}

async function resetSellerOrders() {
  await cleanDeliveries();
  await prisma.sellerOrder.updateMany({
    where: { id: { in: [ids.sellerOrder, ids.otherSellerOrder] } },
    data: {
      status: "CONFIRMED",
      confirmedAt: null,
      cancelledAt: null,
      completedAt: null,
    },
  });
}

async function cleanBatchFixtures() {
  await prisma.deliveryStatusHistory.deleteMany({
    where: {
      deliveryId: { in: batchFixtures.map((fixture) => fixture.deliveryId) },
    },
  });
  await prisma.delivery.deleteMany({
    where: { id: { in: batchFixtures.map((fixture) => fixture.deliveryId) } },
  });
  await prisma.sellerOrder.deleteMany({
    where: {
      id: { in: batchFixtures.map((fixture) => fixture.sellerOrderId) },
    },
  });
  await prisma.seller.deleteMany({
    where: { id: { in: batchFixtures.map((fixture) => fixture.sellerId) } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: batchFixtures.map((fixture) => fixture.userId) } },
  });
}

async function createDelivery(
  user = users.seller,
  sellerOrderId = ids.sellerOrder,
  input = {},
) {
  return new DeliveryService().createDelivery(user, sellerOrderId, input);
}

async function updateDeliveryHistory(deliveryId, changedAt) {
  await prisma.deliveryStatusHistory.updateMany({
    where: { deliveryId },
    data: { changedAt },
  });
}

async function createBaseFixtures() {
  await prisma.user.createMany({
    data: [
      {
        id: ids.customerUser,
        name: "Delivery Customer",
        email: users.customer.email,
        normalizedEmail: users.customer.email,
        password: "test",
        role: "CUSTOMER",
      },
      {
        id: ids.adminUser,
        name: "Delivery Admin",
        email: users.admin.email,
        normalizedEmail: users.admin.email,
        password: "test",
        role: "ADMIN",
      },
      {
        id: ids.sellerUser,
        name: "Delivery Seller",
        email: users.seller.email,
        normalizedEmail: users.seller.email,
        password: "test",
        role: "SELLER",
      },
      {
        id: ids.otherSellerUser,
        name: "Other Delivery Seller",
        email: users.otherSeller.email,
        normalizedEmail: users.otherSeller.email,
        password: "test",
        role: "SELLER",
      },
    ],
  });
  await prisma.customerProfile.create({
    data: { id: ids.customerProfile, userId: ids.customerUser },
  });
  await prisma.seller.createMany({
    data: [
      { id: ids.seller, userId: ids.sellerUser, storeName: "Delivery Store" },
      {
        id: ids.otherSeller,
        userId: ids.otherSellerUser,
        storeName: "Other Delivery Store",
      },
    ],
  });
  await prisma.order.create({
    data: {
      id: ids.order,
      customerId: ids.customerProfile,
      status: "CONFIRMED",
      subtotalInCents: 2000,
      totalInCents: 2000,
      currency: "BRL",
    },
  });
  await prisma.sellerOrder.createMany({
    data: [
      {
        id: ids.sellerOrder,
        orderId: ids.order,
        sellerId: ids.seller,
        status: "CONFIRMED",
        subtotalInCents: 1000,
        totalInCents: 1000,
        currency: "BRL",
      },
      {
        id: ids.otherSellerOrder,
        orderId: ids.order,
        sellerId: ids.otherSeller,
        status: "CONFIRMED",
        subtotalInCents: 1000,
        totalInCents: 1000,
        currency: "BRL",
      },
    ],
  });
}

before(async () => {
  await cleanDeliveries().catch(() => undefined);
  await cleanBatchFixtures().catch(() => undefined);
  await prisma.sellerOrder
    .deleteMany({
      where: { id: { in: [ids.sellerOrder, ids.otherSellerOrder] } },
    })
    .catch(() => undefined);
  await prisma.order
    .deleteMany({ where: { id: ids.order } })
    .catch(() => undefined);
  await prisma.seller
    .deleteMany({ where: { id: { in: [ids.seller, ids.otherSeller] } } })
    .catch(() => undefined);
  await prisma.customerProfile
    .deleteMany({ where: { id: ids.customerProfile } })
    .catch(() => undefined);
  await prisma.user
    .deleteMany({
      where: {
        id: {
          in: [
            ids.customerUser,
            ids.adminUser,
            ids.sellerUser,
            ids.otherSellerUser,
          ],
        },
      },
    })
    .catch(() => undefined);
  await createBaseFixtures();
});

after(async () => {
  await cleanDeliveries();
  await prisma.sellerOrder.deleteMany({
    where: { id: { in: [ids.sellerOrder, ids.otherSellerOrder] } },
  });
  await prisma.order.deleteMany({ where: { id: ids.order } });
  await prisma.seller.deleteMany({
    where: { id: { in: [ids.seller, ids.otherSeller] } },
  });
  await prisma.customerProfile.delete({ where: { id: ids.customerProfile } });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [
          ids.customerUser,
          ids.adminUser,
          ids.sellerUser,
          ids.otherSellerUser,
        ],
      },
    },
  });
  await prisma.$disconnect();
});

test("creates one separated delivery with an initial history", async () => {
  await resetSellerOrders();
  const result = await createDelivery(users.seller, ids.sellerOrder, {
    trackingCode: " TRK-1 ",
    carrier: " Carrier ",
  });
  assert.equal(result.status, "SEPARATED");
  assert.equal(result.trackingCode, "TRK-1");
  assert.equal(result.carrier, "Carrier");
  const history = await prisma.deliveryStatusHistory.findMany({
    where: { deliveryId: result.id },
  });
  assert.equal(history.length, 1);
  assert.equal(history[0].fromStatus, null);
  assert.equal(history[0].toStatus, "SEPARATED");
});

test("enforces creation ownership, roles, compatible parent states and uniqueness", async () => {
  await resetSellerOrders();
  await assert.rejects(
    () => createDelivery(users.otherSeller, ids.sellerOrder),
    ObjectNotFoundError,
  );
  await assert.rejects(
    () => createDelivery(users.customer, ids.sellerOrder),
    ForbiddenError,
  );
  await assert.rejects(
    () => createDelivery(users.seller, ids.otherSellerOrder),
    ObjectNotFoundError,
  );
  const adminDelivery = await createDelivery(users.admin, ids.sellerOrder);
  await assert.rejects(
    () => createDelivery(users.admin, ids.sellerOrder),
    ConflictError,
  );
  await resetSellerOrders();
  await prisma.sellerOrder.update({
    where: { id: ids.sellerOrder },
    data: { status: "PENDING" },
  });
  await assert.rejects(
    () => createDelivery(users.admin, ids.sellerOrder),
    ConflictError,
  );
  await prisma.sellerOrder.update({
    where: { id: ids.sellerOrder },
    data: { status: "CONFIRMED" },
  });
  assert.equal(adminDelivery.status, "SEPARATED");
});

test("concurrent creation produces one delivery", async () => {
  await resetSellerOrders();
  const results = await Promise.allSettled([
    createDelivery(users.seller, ids.sellerOrder),
    createDelivery(users.seller, ids.sellerOrder),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
  );
  assert.equal(
    await prisma.delivery.count({ where: { sellerOrderId: ids.sellerOrder } }),
    1,
  );
});

test("supports the main state flow and exceptional returns", async () => {
  await resetSellerOrders();
  const delivery = await createDelivery();
  const service = new DeliveryService();
  for (const status of [
    "PROCESSING",
    "SHIPPED",
    "COLLECTED",
    "ARRIVED_AT_CENTER",
    "DELIVERED",
  ]) {
    await service.transition(users.seller, delivery.id, { status });
  }
  const delivered = await service.get(users.seller, delivery.id);
  assert.equal(delivered.status, "DELIVERED");
  assert.ok(delivered.deliveredAt);
  const repeated = await service.transition(users.seller, delivery.id, {
    status: "DELIVERED",
  });
  assert.equal(repeated.deliveredAt.getTime(), delivered.deliveredAt.getTime());
  assert.equal(
    await prisma.deliveryStatusHistory.count({
      where: { deliveryId: delivery.id, toStatus: "DELIVERED" },
    }),
    1,
  );
  const historyCount = await prisma.deliveryStatusHistory.count({
    where: { deliveryId: delivery.id },
  });
  await service.transition(users.seller, delivery.id, { status: "RETURNED" });
  assert.equal(
    await prisma.deliveryStatusHistory.count({
      where: { deliveryId: delivery.id },
    }),
    historyCount + 1,
  );

  await resetSellerOrders();
  const failed = await createDelivery();
  await service.transition(users.seller, failed.id, {
    status: "FAILED",
    reason: "  transportadora indisponível  ",
  });
  assert.equal((await service.get(users.seller, failed.id)).status, "FAILED");
  await service.transition(users.seller, failed.id, { status: "RETURNED" });
  assert.equal((await service.get(users.seller, failed.id)).status, "RETURNED");
});

test("rejects invalid transitions and rolls back status when history creation fails", async () => {
  await resetSellerOrders();
  const delivery = await createDelivery();
  const service = new DeliveryService();
  await assert.rejects(
    () =>
      service.transition(users.seller, delivery.id, { status: "DELIVERED" }),
    ConflictError,
  );
  await assert.rejects(
    () =>
      service.transition(users.seller, delivery.id, {
        status: "PROCESSING",
        reason: "x".repeat(501),
      }),
    ValidationError,
  );
  const failing = new DeliveryService(
    new DeliveryRepository({
      beforeHistory: () => {
        throw new Error("history failure");
      },
    }),
  );
  await assert.rejects(
    () =>
      failing.transition(users.seller, delivery.id, { status: "PROCESSING" }),
    /history failure/,
  );
  const stored = await prisma.delivery.findUnique({
    where: { id: delivery.id },
  });
  assert.equal(stored.status, "SEPARATED");
  assert.equal(
    await prisma.deliveryStatusHistory.count({
      where: { deliveryId: delivery.id },
    }),
    1,
  );
});

test("updates tracking with a whitelist and blocks final states", async () => {
  await resetSellerOrders();
  const delivery = await createDelivery();
  const service = new DeliveryService();
  const updated = await service.updateTracking(users.seller, delivery.id, {
    trackingCode: "TRK-2",
    carrier: "Carrier",
    estimatedDelivery: new Date("2026-10-01T00:00:00.000Z"),
  });
  assert.equal(updated.trackingCode, "TRK-2");
  await assert.rejects(
    () =>
      service.updateTracking(users.otherSeller, delivery.id, {
        carrier: "Other",
      }),
    ObjectNotFoundError,
  );
  await service.transition(users.seller, delivery.id, { status: "PROCESSING" });
  await service.transition(users.seller, delivery.id, { status: "SHIPPED" });
  await service.transition(users.seller, delivery.id, { status: "COLLECTED" });
  await service.transition(users.seller, delivery.id, {
    status: "ARRIVED_AT_CENTER",
  });
  await service.transition(users.seller, delivery.id, { status: "DELIVERED" });
  await assert.rejects(
    () =>
      service.updateTracking(users.seller, delivery.id, { carrier: "Changed" }),
    ConflictError,
  );
});

test("customers can read but cannot create or modify deliveries", async () => {
  await resetSellerOrders();
  const delivery = await createDelivery();
  const service = new DeliveryService();

  assert.equal(
    (await service.get(users.customer, delivery.id)).id,
    delivery.id,
  );
  await assert.rejects(
    () => service.createDelivery(users.customer, ids.otherSellerOrder, {}),
    ForbiddenError,
  );
  await assert.rejects(
    () =>
      service.transition(users.customer, delivery.id, { status: "PROCESSING" }),
    ForbiddenError,
  );
  await assert.rejects(
    () =>
      service.updateTracking(users.customer, delivery.id, { carrier: "Nope" }),
    ForbiddenError,
  );

  await resetSellerOrders();
  const adminDelivery = await createDelivery(users.admin, ids.sellerOrder);
  await service.transition(users.admin, adminDelivery.id, {
    status: "PROCESSING",
  });
  const adminTracking = await service.updateTracking(
    users.admin,
    adminDelivery.id,
    { carrier: "Admin Carrier" },
  );
  assert.equal(adminTracking.carrier, "Admin Carrier");
});

test("scopes reads, orders history deterministically and returns explicit DTOs", async () => {
  await resetSellerOrders();
  const delivery = await createDelivery();
  const service = new DeliveryService();
  assert.equal(
    (await service.getBySellerOrder(users.customer, ids.sellerOrder)).id,
    delivery.id,
  );
  assert.equal((await service.get(users.admin, delivery.id)).id, delivery.id);
  await assert.rejects(
    () => service.get(users.otherSeller, delivery.id),
    ObjectNotFoundError,
  );
  await assert.rejects(
    () => service.get(users.customer, "94000000-0000-0000-0000-000000000099"),
    ObjectNotFoundError,
  );
  const dtoKeys = Object.keys(
    await service.get(users.seller, delivery.id),
  ).sort();
  assert.deepEqual(dtoKeys, [
    "carrier",
    "createdAt",
    "deliveredAt",
    "estimatedDelivery",
    "id",
    "sellerOrderId",
    "status",
    "trackingCode",
    "updatedAt",
  ]);
  const history = await service.history(users.customer, delivery.id);
  assert.equal(history.length, 1);
});

test("job progresses an old delivery through the service and is re-runnable", async () => {
  await resetSellerOrders();
  const delivery = await createDelivery();
  await prisma.deliveryStatusHistory.updateMany({
    where: { deliveryId: delivery.id },
    data: { changedAt: new Date("2026-01-01T00:00:00.000Z") },
  });
  await prisma.delivery.update({
    where: { id: delivery.id },
    data: { updatedAt: new Date("2026-01-01T00:00:00.000Z") },
  });
  const {
    updateDeliveryStatuses,
  } = require("../dist/jobs/deliveryStatusUpdater.js");
  await updateDeliveryStatuses();
  assert.equal(
    (await prisma.delivery.findUnique({ where: { id: delivery.id } })).status,
    "PROCESSING",
  );
  assert.equal(
    await prisma.deliveryStatusHistory.count({
      where: { deliveryId: delivery.id },
    }),
    2,
  );
  await updateDeliveryStatuses();
  assert.equal(
    await prisma.deliveryStatusHistory.count({
      where: { deliveryId: delivery.id },
    }),
    2,
  );
});

test("job uses the latest status history instead of updatedAt", async () => {
  await resetSellerOrders();
  const recent = await createDelivery();
  await prisma.delivery.update({
    where: { id: recent.id },
    data: { updatedAt: new Date("2026-01-01T00:00:00.000Z") },
  });

  await updateDeliveryHistory(recent.id, new Date());
  const { updateDeliveryStatuses } = require(
    "../dist/jobs/deliveryStatusUpdater.js",
  );
  await updateDeliveryStatuses();

  assert.equal(
    (await prisma.delivery.findUnique({ where: { id: recent.id } })).status,
    "SEPARATED",
  );
});

test("recent tracking does not reset an eligible status clock", async () => {
  await resetSellerOrders();
  const delivery = await createDelivery();
  await updateDeliveryHistory(
    delivery.id,
    new Date("2026-01-01T00:00:00.000Z"),
  );

  const service = new DeliveryService();
  await service.updateTracking(users.seller, delivery.id, {
    trackingCode: "RECENT-TRACKING",
  });

  const { updateDeliveryStatuses } = require(
    "../dist/jobs/deliveryStatusUpdater.js",
  );
  await updateDeliveryStatuses();

  assert.equal(
    (await prisma.delivery.findUnique({ where: { id: delivery.id } })).status,
    "PROCESSING",
  );
  assert.equal(
    await prisma.deliveryStatusHistory.count({
      where: { deliveryId: delivery.id },
    }),
    2,
  );
});

test("job skips deliveries without a consistent latest history", async () => {
  await resetSellerOrders();
  const withoutHistory = await createDelivery();
  await prisma.deliveryStatusHistory.deleteMany({
    where: { deliveryId: withoutHistory.id },
  });

  const inconsistent = await createDelivery(
    users.otherSeller,
    ids.otherSellerOrder,
  );
  await prisma.deliveryStatusHistory.updateMany({
    where: { deliveryId: inconsistent.id },
    data: {
      toStatus: "PROCESSING",
      changedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  });

  const { updateDeliveryStatuses } = require(
    "../dist/jobs/deliveryStatusUpdater.js",
  );
  await updateDeliveryStatuses();

  const skipped = await prisma.delivery.findMany({
    where: { id: { in: [withoutHistory.id, inconsistent.id] } },
    select: { id: true, status: true },
  });
  assert.deepEqual(
    skipped.sort((left, right) => left.id.localeCompare(right.id)),
    [
      { id: inconsistent.id, status: "SEPARATED" },
      { id: withoutHistory.id, status: "SEPARATED" },
    ].sort((left, right) => left.id.localeCompare(right.id)),
  );
});

test("job walks all eligible deliveries with a stable keyset cursor", async () => {
  await cleanBatchFixtures();
  await prisma.user.createMany({
    data: batchFixtures.map((fixture, index) => ({
      id: fixture.userId,
      name: `Batch User ${index}`,
      email: `delivery-batch-${index}@local.invalid`,
      normalizedEmail: `delivery-batch-${index}@local.invalid`,
      password: "test",
      role: "SELLER",
    })),
  });
  await prisma.seller.createMany({
    data: batchFixtures.map((fixture, index) => ({
      id: fixture.sellerId,
      userId: fixture.userId,
      storeName: `Batch Store ${index}`,
    })),
  });
  await prisma.sellerOrder.createMany({
    data: batchFixtures.map((fixture) => ({
      id: fixture.sellerOrderId,
      orderId: ids.order,
      sellerId: fixture.sellerId,
      status: "CONFIRMED",
      subtotalInCents: 100,
      totalInCents: 100,
      currency: "BRL",
    })),
  });
  await prisma.delivery.createMany({
    data: batchFixtures.map((fixture) => ({
      id: fixture.deliveryId,
      sellerOrderId: fixture.sellerOrderId,
      status: "SEPARATED",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })),
  });
  await prisma.deliveryStatusHistory.createMany({
    data: batchFixtures.map((fixture) => ({
      deliveryId: fixture.deliveryId,
      fromStatus: null,
      toStatus: "SEPARATED",
      changedAt: new Date("2026-01-01T00:00:00.000Z"),
    })),
  });

  const {
    updateDeliveryStatuses,
  } = require("../dist/jobs/deliveryStatusUpdater.js");
  await updateDeliveryStatuses();
  assert.equal(
    await prisma.delivery.count({
      where: {
        id: { in: batchFixtures.map((fixture) => fixture.deliveryId) },
        status: "PROCESSING",
      },
    }),
    batchFixtures.length,
  );
  assert.equal(
    await prisma.deliveryStatusHistory.count({
      where: {
        deliveryId: { in: batchFixtures.map((fixture) => fixture.deliveryId) },
      },
    }),
    batchFixtures.length * 2,
  );

  await updateDeliveryStatuses();
  assert.equal(
    await prisma.deliveryStatusHistory.count({
      where: {
        deliveryId: { in: batchFixtures.map((fixture) => fixture.deliveryId) },
      },
    }),
    batchFixtures.length * 2,
  );
  await cleanBatchFixtures();
  assert.equal(
    await prisma.delivery.count({
      where: { id: { in: batchFixtures.map((fixture) => fixture.deliveryId) } },
    }),
    0,
  );
});
