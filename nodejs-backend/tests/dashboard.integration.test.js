const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
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
  throw new Error("Dashboard tests require localhost:5433/marketplace_dev");
}
process.env.DATABASE_URL = url.toString();
process.env.JWT_SECRET = "dashboard-test-secret";

const prisma = new PrismaClient();
const { DashboardService } = require("../dist/services/dashboardService.js");

const ids = {
  userOne: "98000000-0000-0000-0000-000000000001",
  userTwo: "98000000-0000-0000-0000-000000000002",
  customerOne: "98000000-0000-0000-0000-000000000011",
  customerTwo: "98000000-0000-0000-0000-000000000012",
  orderOne: "98000000-0000-0000-0000-000000000021",
  orderTwo: "98000000-0000-0000-0000-000000000022",
  orderThree: "98000000-0000-0000-0000-000000000023",
  orderFour: "98000000-0000-0000-0000-000000000024",
  sellerOrderOne: "98000000-0000-0000-0000-000000000031",
  sellerOrderTwo: "98000000-0000-0000-0000-000000000032",
  sellerOrderThree: "98000000-0000-0000-0000-000000000033",
  sellerOrderFour: "98000000-0000-0000-0000-000000000034",
  orderItemOne: "98000000-0000-0000-0000-000000000041",
  orderItemTwo: "98000000-0000-0000-0000-000000000042",
  orderItemThree: "98000000-0000-0000-0000-000000000043",
  orderItemFour: "98000000-0000-0000-0000-000000000044",
};

const sellerId = "00000000-0000-0000-0000-000000000301";
const productId = "00000000-0000-0000-0000-000000000401";
const sellerUser = {
  id: "00000000-0000-0000-0000-000000000003",
  email: "seller.one.seed@local.invalid",
  role: "SELLER",
};
const customerUser = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "customer.seed@local.invalid",
  role: "CUSTOMER",
};

const dates = {
  oldCreated: new Date("2026-01-01T12:00:00.000Z"),
  oldCompleted: new Date("2026-01-02T12:00:00.000Z"),
  recentCreated: new Date("2026-09-05T12:00:00.000Z"),
  recentCompleted: new Date("2026-09-06T12:00:00.000Z"),
};

async function cleanFixtures() {
  await prisma.orderItem.deleteMany({
    where: {
      id: {
        in: [ids.orderItemOne, ids.orderItemTwo, ids.orderItemThree, ids.orderItemFour],
      },
    },
  });
  await prisma.sellerOrder.deleteMany({
    where: {
      id: {
        in: [ids.sellerOrderOne, ids.sellerOrderTwo, ids.sellerOrderThree, ids.sellerOrderFour],
      },
    },
  });
  await prisma.order.deleteMany({
    where: {
      id: { in: [ids.orderOne, ids.orderTwo, ids.orderThree, ids.orderFour] },
    },
  });
  await prisma.customerProfile.deleteMany({
    where: { id: { in: [ids.customerOne, ids.customerTwo] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.userOne, ids.userTwo] } },
  });
}

async function createFixtures() {
  await prisma.user.createMany({
    data: [ids.userOne, ids.userTwo].map((id, index) => ({
      id,
      name: `Dashboard Customer ${index + 1}`,
      email: `dashboard-customer-${index + 1}@local.invalid`,
      normalizedEmail: `dashboard-customer-${index + 1}@local.invalid`,
      password: "development-only",
      role: "CUSTOMER",
    })),
  });
  await prisma.customerProfile.createMany({
    data: [
      { id: ids.customerOne, userId: ids.userOne },
      { id: ids.customerTwo, userId: ids.userTwo },
    ],
  });
  await prisma.order.createMany({
    data: [
      {
        id: ids.orderOne,
        customerId: ids.customerOne,
        status: "CONFIRMED",
        subtotalInCents: 1000,
        totalInCents: 1000,
        currency: "BRL",
        createdAt: dates.oldCreated,
      },
      {
        id: ids.orderTwo,
        customerId: ids.customerOne,
        status: "CONFIRMED",
        subtotalInCents: 2000,
        totalInCents: 2000,
        currency: "BRL",
        createdAt: dates.recentCreated,
      },
      {
        id: ids.orderThree,
        customerId: ids.customerTwo,
        status: "CONFIRMED",
        subtotalInCents: 3000,
        totalInCents: 3000,
        currency: "BRL",
        createdAt: dates.recentCreated,
      },
      {
        id: ids.orderFour,
        customerId: ids.customerTwo,
        status: "CONFIRMED",
        subtotalInCents: 4000,
        totalInCents: 4000,
        currency: "BRL",
        createdAt: dates.recentCreated,
      },
    ],
  });
  await prisma.sellerOrder.createMany({
    data: [
      {
        id: ids.sellerOrderOne,
        orderId: ids.orderOne,
        sellerId,
        status: "DELIVERED",
        subtotalInCents: 1000,
        totalInCents: 1000,
        currency: "BRL",
        createdAt: dates.oldCreated,
        completedAt: dates.oldCompleted,
      },
      {
        id: ids.sellerOrderTwo,
        orderId: ids.orderTwo,
        sellerId,
        status: "DELIVERED",
        subtotalInCents: 2000,
        totalInCents: 2000,
        currency: "BRL",
        createdAt: dates.recentCreated,
        completedAt: dates.recentCompleted,
      },
      {
        id: ids.sellerOrderThree,
        orderId: ids.orderThree,
        sellerId,
        status: "DELIVERED",
        subtotalInCents: 3000,
        totalInCents: 3000,
        currency: "BRL",
        createdAt: dates.recentCreated,
        completedAt: dates.recentCompleted,
      },
      {
        id: ids.sellerOrderFour,
        orderId: ids.orderFour,
        sellerId,
        status: "RETURNED",
        subtotalInCents: 4000,
        totalInCents: 4000,
        currency: "BRL",
        createdAt: dates.recentCreated,
      },
    ],
  });
  await prisma.orderItem.createMany({
    data: [
      [ids.orderItemOne, ids.sellerOrderOne, 1, 1000],
      [ids.orderItemTwo, ids.sellerOrderTwo, 2, 2000],
      [ids.orderItemThree, ids.sellerOrderThree, 3, 3000],
      [ids.orderItemFour, ids.sellerOrderFour, 4, 4000],
    ].map(([id, sellerOrderId, quantity, total]) => ({
      id,
      sellerOrderId,
      productId,
      quantity,
      unitPriceInCents: total / quantity,
      lineTotalInCents: total,
      currency: "BRL",
      productNameSnapshot: "Dashboard Snapshot Product",
      sellerNameSnapshot: "Development Store One",
    })),
  });
}

before(async () => {
  await cleanFixtures();
  await createFixtures();
});

after(async () => {
  await cleanFixtures();
  await prisma.$disconnect();
});

test("summary uses delivered SellerOrder totals and completedAt", async () => {
  const service = new DashboardService();
  const summary = await service.getSummary(sellerUser, {
    from: new Date("2026-09-01T00:00:00.000Z"),
    to: new Date("2026-09-30T00:00:00.000Z"),
  });
  assert.deepEqual(summary, {
    currency: "BRL",
    grossRevenueInCents: 5000,
    deliveredSellerOrders: 2,
    itemsSold: 5,
    averageTicketInCents: 2500,
  });
});

test("orders, statuses and analytics are seller-scoped and filtered in the database", async () => {
  const service = new DashboardService();
  const orders = await service.getOrders(
    sellerUser,
    { from: new Date("2026-09-01T00:00:00.000Z"), to: new Date("2026-09-30T00:00:00.000Z") },
    { page: 1, limit: 1 },
    "DELIVERED",
  );
  assert.equal(orders.pagination.total, 2);
  assert.equal(orders.data.length, 1);
  assert.equal(orders.data[0].totalInCents, 3000);

  const byStatus = await service.getOrdersByStatus(sellerUser, {
    from: new Date("2026-09-01T00:00:00.000Z"),
    to: new Date("2026-09-30T00:00:00.000Z"),
  });
  assert.equal(byStatus.find((item) => item.status === "DELIVERED").count, 2);
  assert.equal(byStatus.length, 7);

  const categories = await service.getByCategory(sellerUser, {
    from: new Date("2026-09-01T00:00:00.000Z"),
    to: new Date("2026-09-30T00:00:00.000Z"),
  });
  assert.equal(categories[0].grossRevenueInCents, 5000);
  assert.equal(categories[0].itemsSold, 5);

  const top = await service.getTopProducts(
    sellerUser,
    { from: new Date("2026-09-01T00:00:00.000Z"), to: new Date("2026-09-30T00:00:00.000Z") },
    5,
  );
  assert.equal(top[0].itemsSold, 5);
  assert.equal(top[0].grossRevenueInCents, 5000);
});

test("top products uses the latest eligible snapshot instead of lexical MAX", async () => {
  const originalItems = await prisma.orderItem.findMany({
    where: {
      id: { in: [ids.orderItemTwo, ids.orderItemThree] },
    },
    select: {
      id: true,
      productNameSnapshot: true,
      createdAt: true,
    },
  });

  try {
    await prisma.orderItem.update({
      where: { id: ids.orderItemTwo },
      data: {
        productNameSnapshot: "Zebra snapshot",
        createdAt: new Date("2026-09-08T12:00:00.000Z"),
      },
    });
    await prisma.orderItem.update({
      where: { id: ids.orderItemThree },
      data: {
        productNameSnapshot: "Alpha snapshot",
        createdAt: new Date("2026-09-09T12:00:00.000Z"),
      },
    });

    const service = new DashboardService();
    const top = await service.getTopProducts(
      sellerUser,
      {
        from: new Date("2026-09-01T00:00:00.000Z"),
        to: new Date("2026-09-30T00:00:00.000Z"),
      },
      5,
    );

    assert.equal(top[0].productName, "Alpha snapshot");
  } finally {
    for (const item of originalItems) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          productNameSnapshot: item.productNameSnapshot,
          createdAt: item.createdAt,
        },
      });
    }
  }
});

test("timeseries fills gaps and first seller purchase defines new customers", async () => {
  const service = new DashboardService();
  const daily = await service.getTimeseries(
    sellerUser,
    { from: new Date("2026-09-05T00:00:00.000Z"), to: new Date("2026-09-07T00:00:00.000Z") },
    "day",
  );
  assert.equal(daily.length, 3);
  assert.equal(daily[0].grossRevenueInCents, 0);
  assert.equal(daily[1].grossRevenueInCents, 5000);

  const monthly = await service.getTimeseries(
    sellerUser,
    { from: new Date("2026-01-01T00:00:00.000Z"), to: new Date("2026-09-30T00:00:00.000Z") },
    "month",
  );
  assert.equal(monthly[0].period, "2026-01");
  assert.equal(monthly.at(-1).period, "2026-09");

  const newCustomers = await service.getNewCustomers(sellerUser, {
    from: new Date("2026-09-01T00:00:00.000Z"),
    to: new Date("2026-09-30T00:00:00.000Z"),
  });
  assert.equal(newCustomers[0].newCustomers, 1);
});

test("daily and monthly timeseries intersect buckets with the requested interval", async () => {
  const originalDates = await prisma.sellerOrder.findMany({
    where: {
      id: { in: [ids.sellerOrderTwo, ids.sellerOrderThree] },
    },
    select: { id: true, completedAt: true },
  });

  try {
    await prisma.sellerOrder.update({
      where: { id: ids.sellerOrderTwo },
      data: { completedAt: new Date("2026-09-10T12:00:00.000Z") },
    });
    await prisma.sellerOrder.update({
      where: { id: ids.sellerOrderThree },
      data: { completedAt: new Date("2026-09-20T12:00:00.000Z") },
    });

    const service = new DashboardService();
    const range = {
      from: new Date("2026-09-15T00:00:00.000Z"),
      to: new Date("2026-09-20T00:00:00.000Z"),
    };
    const monthly = await service.getTimeseries(sellerUser, range, "month");
    const daily = await service.getTimeseries(sellerUser, range, "day");

    assert.deepEqual(monthly, [
      {
        period: "2026-09",
        grossRevenueInCents: 3000,
        sellerOrders: 1,
      },
    ]);
    assert.equal(daily.length, 6);
    assert.equal(daily[0].grossRevenueInCents, 0);
    assert.equal(daily[4].period, "2026-09-19");
    assert.equal(daily[4].grossRevenueInCents, 0);
    assert.equal(daily[5].period, "2026-09-20");
    assert.equal(daily[5].grossRevenueInCents, 3000);
  } finally {
    for (const sellerOrder of originalDates) {
      await prisma.sellerOrder.update({
        where: { id: sellerOrder.id },
        data: { completedAt: sellerOrder.completedAt },
      });
    }
  }
});

test("ownership is derived from the authenticated user and legacy parameter routes are absent", async () => {
  const service = new DashboardService();
  await assert.rejects(
    () => service.getSummary(customerUser, {}),
    /permission/,
  );
  const { app } = require("../dist/server.js");
  const server = app.listen(0);
  const port = server.address().port;
  const token = jwt.sign({ sub: sellerUser.id }, process.env.JWT_SECRET);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/dashboard/seller/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const legacy = await fetch(
      `http://127.0.0.1:${port}/dashboard/sellers/salesStats/${sellerId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(legacy.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("dashboard rejects invalid and inverted date ranges through HTTP", async () => {
  const { app } = require("../dist/server.js");
  const server = app.listen(0);
  const port = server.address().port;
  const token = jwt.sign({ sub: sellerUser.id }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };

  try {
    const invalidDate = await fetch(
      `http://127.0.0.1:${port}/dashboard/seller/sales/timeseries?from=2026-02-30&to=2026-03-01&interval=day`,
      { headers },
    );
    assert.equal(invalidDate.status, 400);

    const inverted = await fetch(
      `http://127.0.0.1:${port}/dashboard/seller/sales/timeseries?from=2026-09-20&to=2026-09-19&interval=day`,
      { headers },
    );
    assert.equal(inverted.status, 400);

    const invalidFormat = await fetch(
      `http://127.0.0.1:${port}/dashboard/seller/sales/timeseries?from=09-01-2026&to=2026-09-19&interval=day`,
      { headers },
    );
    assert.equal(invalidFormat.status, 400);

    const excessiveRange = await fetch(
      `http://127.0.0.1:${port}/dashboard/seller/sales/timeseries?from=2025-01-01&to=2026-09-19&interval=month`,
      { headers },
    );
    assert.equal(excessiveRange.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
