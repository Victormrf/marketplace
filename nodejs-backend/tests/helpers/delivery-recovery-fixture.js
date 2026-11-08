const assert = require("node:assert/strict");
const databaseUrl = new URL(
  process.env.TEST_DELIVERY_DATABASE_URL ||
    "postgresql://marketplace_dev:marketplace_dev_password@127.0.0.1:5433/marketplace_dev",
);
const redisUrl = new URL(
  process.env.TEST_DELIVERY_REDIS_URL || "redis://127.0.0.1:6381/15",
);
if (
  !["127.0.0.1", "localhost"].includes(databaseUrl.hostname) ||
  databaseUrl.port !== "5433" ||
  databaseUrl.pathname !== "/marketplace_dev" ||
  databaseUrl.username !== "marketplace_dev"
) {
  throw new Error(
    "Recovery fixtures require localhost:5433/marketplace_dev as marketplace_dev",
  );
}
if (
  !["127.0.0.1", "localhost"].includes(redisUrl.hostname) ||
  redisUrl.port !== "6381" ||
  redisUrl.pathname !== "/15"
) {
  throw new Error("Recovery tests require dedicated localhost:6381/15");
}
process.env.DATABASE_URL = databaseUrl.toString();
const prisma = require("../../dist/config/db").default;
const {
  discoverDeliveryProgressionJobs,
} = require("../../dist/jobs/deliveryProgression");
const id = (number) =>
  `97300000-0000-0000-0000-${String(number).padStart(12, "0")}`;
const root = {
  customerUser: id(1),
  sellerUser: id(2),
  customer: id(3),
  seller: id(4),
};
const emails = [
  "delivery-recovery-customer@local.invalid",
  "delivery-recovery-seller@local.invalid",
];

async function prepareFixtures(count = 1) {
  assert.ok(Number.isInteger(count) && count >= 1 && count <= 2);
  const identity =
    await prisma.$queryRaw`SELECT current_database() AS database, current_user AS role`;
  assert.equal(identity[0].database, "marketplace_dev");
  assert.equal(identity[0].role, "marketplace_dev");
  assert.equal(
    await prisma.user.count({
      where: {
        OR: [
          { id: { in: [root.customerUser, root.sellerUser] } },
          { normalizedEmail: { in: emails } },
        ],
      },
    }),
    0,
  );
  const deliveries = Array.from({ length: count }, (_, index) => ({
    orderId: id(100 + index * 10),
    sellerOrderId: id(101 + index * 10),
    deliveryId: id(102 + index * 10),
    historyId: id(103 + index * 10),
  }));
  const createdAt = new Date(Date.now() - 6 * 3600000);
  const separatedAt = new Date(Date.now() - 5 * 3600000);
  await prisma.$transaction(async (tx) => {
    await tx.user.createMany({
      data: [
        {
          id: root.customerUser,
          name: "Recovery Test Customer",
          email: emails[0],
          normalizedEmail: emails[0],
          password: "not-a-login-password",
          role: "CUSTOMER",
          createdAt,
        },
        {
          id: root.sellerUser,
          name: "Recovery Test Seller",
          email: emails[1],
          normalizedEmail: emails[1],
          password: "not-a-login-password",
          role: "SELLER",
          createdAt,
        },
      ],
    });
    await tx.customerProfile.create({
      data: { id: root.customer, userId: root.customerUser, createdAt },
    });
    await tx.seller.create({
      data: {
        id: root.seller,
        userId: root.sellerUser,
        storeName: "Recovery Test Seller",
        createdAt,
      },
    });
    for (const record of deliveries) {
      await tx.order.create({
        data: {
          id: record.orderId,
          customerId: root.customer,
          status: "CONFIRMED",
          subtotalInCents: 0,
          totalInCents: 0,
          currency: "BRL",
          createdAt,
          confirmedAt: separatedAt,
        },
      });
      await tx.sellerOrder.create({
        data: {
          id: record.sellerOrderId,
          orderId: record.orderId,
          sellerId: root.seller,
          status: "CONFIRMED",
          subtotalInCents: 0,
          totalInCents: 0,
          currency: "BRL",
          createdAt,
          confirmedAt: separatedAt,
        },
      });
      await tx.delivery.create({
        data: {
          id: record.deliveryId,
          sellerOrderId: record.sellerOrderId,
          status: "SEPARATED",
          createdAt: separatedAt,
          updatedAt: separatedAt,
        },
      });
      await tx.deliveryStatusHistory.create({
        data: {
          id: record.historyId,
          deliveryId: record.deliveryId,
          toStatus: "SEPARATED",
          changedAt: separatedAt,
        },
      });
    }
  });
  return { deliveries, cleanup: () => cleanupFixtures(deliveries) };
}

async function cleanupFixtures(deliveries) {
  const deliveryIds = deliveries.map((record) => record.deliveryId);
  const sellerOrderIds = deliveries.map((record) => record.sellerOrderId);
  const orderIds = deliveries.map((record) => record.orderId);
  await prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany({
      where: { id: { in: [root.customerUser, root.sellerUser] } },
    });
    assert.equal(users.length, 2);
    assert.ok(users.every((user) => emails.includes(user.normalizedEmail)));
    const current = await tx.delivery.findMany({
      where: { id: { in: deliveryIds } },
    });
    assert.ok(
      current.every((row) =>
        deliveries.some(
          (record) =>
            record.deliveryId === row.id &&
            record.sellerOrderId === row.sellerOrderId,
        ),
      ),
    );
    const orders = await tx.sellerOrder.findMany({
      where: { id: { in: sellerOrderIds } },
    });
    assert.ok(
      orders.every(
        (row) => row.sellerId === root.seller && orderIds.includes(row.orderId),
      ),
    );
    await tx.deliveryStatusHistory.deleteMany({
      where: { deliveryId: { in: deliveryIds } },
    });
    await tx.delivery.deleteMany({
      where: { id: { in: deliveryIds }, sellerOrderId: { in: sellerOrderIds } },
    });
    await tx.sellerOrder.deleteMany({
      where: {
        id: { in: sellerOrderIds },
        sellerId: root.seller,
        orderId: { in: orderIds },
      },
    });
    await tx.order.deleteMany({
      where: { id: { in: orderIds }, customerId: root.customer },
    });
    await tx.seller.deleteMany({
      where: { id: root.seller, userId: root.sellerUser },
    });
    await tx.customerProfile.deleteMany({
      where: { id: root.customer, userId: root.customerUser },
    });
    await tx.user.deleteMany({
      where: {
        id: { in: [root.customerUser, root.sellerUser] },
        normalizedEmail: { in: emails },
      },
    });
  });
  assert.equal(
    await prisma.delivery.count({ where: { id: { in: deliveryIds } } }),
    0,
  );
  assert.equal(
    await prisma.deliveryStatusHistory.count({
      where: { deliveryId: { in: deliveryIds } },
    }),
    0,
  );
  assert.equal(
    await prisma.order.count({ where: { id: { in: orderIds } } }),
    0,
  );
  assert.equal(
    await prisma.user.count({
      where: { id: { in: [root.customerUser, root.sellerUser] } },
    }),
    0,
  );
}

function discoverFixtures(fixture) {
  const ids = fixture.deliveries.map((record) => record.deliveryId);
  // Real Prisma reads, strictly restricted to this fixture. Never global discovery.
  return discoverDeliveryProgressionJobs({
    async findForJob(afterId, take) {
      return prisma.delivery.findMany({
        where: {
          id: { in: ids, ...(afterId ? { gt: afterId } : {}) },
          status: { notIn: ["DELIVERED", "RETURNED"] },
        },
        orderBy: { id: "asc" },
        take,
        select: {
          id: true,
          status: true,
          statusHistory: {
            orderBy: [{ changedAt: "desc" }, { id: "desc" }],
            take: 1,
            select: { id: true, toStatus: true, changedAt: true },
          },
        },
      });
    },
  });
}
async function snapshot(record) {
  return {
    delivery: await prisma.delivery.findUnique({
      where: { id: record.deliveryId },
      select: { id: true, status: true, updatedAt: true, deliveredAt: true },
    }),
    history: await prisma.deliveryStatusHistory.findMany({
      where: { deliveryId: record.deliveryId },
      orderBy: [{ changedAt: "asc" }, { id: "asc" }],
    }),
  };
}
async function oneContract(fixture) {
  const iterator = discoverFixtures(fixture);
  const result = await iterator.next();
  assert.ok(result.value);
  await iterator.return();
  return result.value;
}
module.exports = {
  prisma,
  databaseUrl,
  redisUrl,
  prepareFixtures,
  discoverFixtures,
  snapshot,
  oneContract,
  allowedDeliveryIds: [id(102), id(112)],
};
