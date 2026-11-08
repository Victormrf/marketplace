const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");

const redisUrl = new URL(
  process.env.TEST_DELIVERY_REDIS_URL || "redis://127.0.0.1:6381/15",
);
const databaseUrl = new URL(
  process.env.TEST_DELIVERY_DATABASE_URL ||
    "postgresql://marketplace_dev:marketplace_dev_password@127.0.0.1:5433/marketplace_dev",
);
if (
  !["127.0.0.1", "localhost"].includes(redisUrl.hostname) ||
  redisUrl.port !== "6381" ||
  redisUrl.pathname !== "/15"
) {
  throw new Error("Queue integration requires dedicated localhost:6381/15");
}
if (
  !["127.0.0.1", "localhost"].includes(databaseUrl.hostname) ||
  databaseUrl.port !== "5433" ||
  databaseUrl.pathname !== "/marketplace_dev" ||
  databaseUrl.username !== "marketplace_dev"
) {
  throw new Error(
    "Fixture requires localhost:5433/marketplace_dev as marketplace_dev",
  );
}
process.env.DATABASE_URL = databaseUrl.toString();
const { Prisma } = require("@prisma/client");
const prisma = require("../dist/config/db").default;
const { createLogger } = require("../dist/utils/logger");
const {
  deliveryProgressionJobId,
} = require("../dist/types/deliveryProgression");
const {
  DELIVERY_JOB,
  DELIVERY_JOB_OPTIONS,
  deliveryQueueConfig,
  createDeliveryQueue,
  createDeliveryWorker,
  publishDeliveryJobs,
  closeDeliveryWorker,
  queueDeadline,
} = require("../dist/jobs/deliveryQueue");
const quiet = createLogger({ sink() {} });
function payload(id = randomUUID()) {
  return {
    version: 1,
    deliveryId: id,
    expectedStatus: "SEPARATED",
    expectedHistoryId: randomUUID(),
    eligibleBefore: new Date(Date.now() - 4 * 3600000).toISOString(),
  };
}
async function* one(value) {
  yield value;
}
async function environment(t) {
  const config = deliveryQueueConfig({
    DELIVERY_REDIS_URL: redisUrl.toString(),
    DELIVERY_QUEUE_PREFIX: `delivery-test-${randomUUID()}`,
  });
  const queue = createDeliveryQueue(config, quiet);
  const workers = [];
  let running;
  t.after(async () => {
    for (const worker of workers) {
      assert.equal(
        await closeDeliveryWorker(worker, async () => {}, 5000, quiet),
        true,
      );
    }
    // Removes only this random queue/prefix, after its workers have stopped.
    await queue.obliterate({ force: false });
    const client = await queue.client;
    assert.equal((await client.keys(`${config.prefix}:*`)).length, 0);
    await queue.close();
    assert.equal(client.status, "end");
  });
  await queueDeadline(queue.waitUntilReady(), 5000);
  const client = await queue.client;
  assert.equal(await client.ping(), "PONG");
  const settings = await client.config("GET", "appendonly", "maxmemory-policy");
  assert.ok(settings.includes("yes"));
  assert.ok(settings.includes("noeviction"));
  return {
    queue,
    start(processJob) {
      const worker = createDeliveryWorker(config, processJob, quiet);
      workers.push(worker);
      running = worker.run();
      running.catch(() => {});
      return worker;
    },
  };
}
async function state(queue, id, expected) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const job = await queue.getJob(id);
    if (job && (await job.getState()) === expected) {
      // getState is a second Redis read: refresh fields after the terminal state
      // so attemptsMade/returnvalue cannot come from the preceding active state.
      return queue.getJob(id);
    }
    // Conditional polling of real queue state, not a fixed wait for success.
    await delay(25);
  }
  throw new Error(`Queue did not reach ${expected}`);
}
test.after(async () => {
  await prisma.$disconnect();
});

test("real Redis confirms deterministic publication and deduplicates retained identities", async (t) => {
  const env = await environment(t);
  const data = payload();
  assert.equal(await publishDeliveryJobs(env.queue, one(data), quiet), 1);
  assert.equal(await publishDeliveryJobs(env.queue, one(data), quiet), 1);
  assert.equal(await env.queue.getWaitingCount(), 1);
  let calls = 0;
  env.start(async (input) => {
    calls++;
    return { deliveryId: input.deliveryId, outcome: "applied" };
  });
  const job = await state(
    env.queue,
    deliveryProgressionJobId(data),
    "completed",
  );
  assert.equal(calls, 1);
  assert.equal(job.returnvalue.outcome, "applied");
  assert.equal(job.attemptsMade, 1);
});

test("ignored messages complete once without retry", async (t) => {
  const env = await environment(t);
  const data = payload();
  let calls = 0;
  env.start(async (input) => {
    calls++;
    return { deliveryId: input.deliveryId, outcome: "ignored" };
  });
  await publishDeliveryJobs(env.queue, one(data), quiet);
  const job = await state(
    env.queue,
    deliveryProgressionJobId(data),
    "completed",
  );
  assert.equal(job.returnvalue.outcome, "ignored");
  assert.equal(job.attemptsMade, 1);
  assert.equal(calls, 1);
});

test("invalid payload and invalid name fail terminally on their first attempt", async (t) => {
  const env = await environment(t);
  let calls = 0;
  env.start(async () => {
    calls++;
    assert.fail("Invalid message reached domain");
  });
  for (const [id, name, data] of [
    ["invalid-version", DELIVERY_JOB, payload("private-delivery-invalid")],
    ["invalid-name", "unapproved-name", payload()],
  ]) {
    if (id === "invalid-version") {
      data.version = 2;
      data.secret = "private-cookie";
    }
    await env.queue.add(name, data, { ...DELIVERY_JOB_OPTIONS, jobId: id });
    const job = await state(env.queue, id, "failed");
    assert.equal(job.attemptsMade, 1);
    assert.equal(job.failedReason, "INVALID_DELIVERY_JOB");
    assert.ok(!JSON.stringify(job.stacktrace).includes("private"));
  }
  assert.equal(calls, 0);
});

test("recognized transient failure retries with backoff and then succeeds", async (t) => {
  const env = await environment(t);
  const data = payload();
  const starts = [];
  env.start(async (input) => {
    starts.push(Date.now());
    if (starts.length === 1) {
      throw new Prisma.PrismaClientKnownRequestError("private password SQL", {
        code: "P1001",
        clientVersion: "6.11.1",
      });
    }
    return { deliveryId: input.deliveryId, outcome: "applied" };
  });
  await publishDeliveryJobs(env.queue, one(data), quiet);
  const job = await state(
    env.queue,
    deliveryProgressionJobId(data),
    "completed",
  );
  assert.equal(starts.length, 2);
  assert.equal(job.attemptsMade, 2);
  assert.ok(starts[1] - starts[0] >= 900);
  assert.ok(!JSON.stringify(job.stacktrace).includes("private"));
});

test("persistent transient failure exhausts exactly three attempts and stays failed", async (t) => {
  const env = await environment(t);
  const data = payload();
  const starts = [];
  env.start(async () => {
    starts.push(Date.now());
    throw new Prisma.PrismaClientKnownRequestError("private database details", {
      code: "P2024",
      clientVersion: "6.11.1",
    });
  });
  await publishDeliveryJobs(env.queue, one(data), quiet);
  const job = await state(env.queue, deliveryProgressionJobId(data), "failed");
  assert.equal(starts.length, 3);
  assert.equal(job.attemptsMade, 3);
  assert.equal(job.failedReason, "DATABASE_TIMEOUT");
  assert.ok(starts[1] - starts[0] >= 900);
  assert.ok(starts[2] - starts[1] >= 1900);
  assert.ok(!JSON.stringify(job.stacktrace).includes("private"));
});

test("unknown errors are terminal and stored without their raw details", async (t) => {
  const env = await environment(t);
  const data = payload();
  let calls = 0;
  env.start(async () => {
    calls++;
    throw new Error("private user password SQL");
  });
  await publishDeliveryJobs(env.queue, one(data), quiet);
  const job = await state(env.queue, deliveryProgressionJobId(data), "failed");
  assert.equal(calls, 1);
  assert.equal(job.attemptsMade, 1);
  assert.equal(job.failedReason, "UNEXPECTED_DELIVERY_JOB_ERROR");
  assert.ok(!JSON.stringify(job.stacktrace).includes("private"));
});

const ids = Object.fromEntries(
  [
    "customerUser",
    "sellerUser",
    "customer",
    "seller",
    "order",
    "sellerOrder",
    "delivery",
    "history",
  ].map((name, index) => [
    name,
    `97200000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
  ]),
);
async function cleanupFixture() {
  await prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany({
      where: { id: { in: [ids.customerUser, ids.sellerUser] } },
    });
    assert.ok(
      users.every(
        (user) =>
          user.normalizedEmail ===
          `delivery-queue-${user.role.toLowerCase()}@local.invalid`,
      ),
    );
    const delivery = await tx.delivery.findUnique({
      where: { id: ids.delivery },
    });
    assert.ok(!delivery || delivery.sellerOrderId === ids.sellerOrder);
    const sellerOrder = await tx.sellerOrder.findUnique({
      where: { id: ids.sellerOrder },
    });
    assert.ok(
      !sellerOrder ||
        (sellerOrder.orderId === ids.order &&
          sellerOrder.sellerId === ids.seller),
    );
    const order = await tx.order.findUnique({ where: { id: ids.order } });
    assert.ok(!order || order.customerId === ids.customer);
    await tx.deliveryStatusHistory.deleteMany({
      where: { deliveryId: ids.delivery },
    });
    await tx.delivery.deleteMany({
      where: { id: ids.delivery, sellerOrderId: ids.sellerOrder },
    });
    await tx.sellerOrder.deleteMany({
      where: { id: ids.sellerOrder, sellerId: ids.seller, orderId: ids.order },
    });
    await tx.order.deleteMany({
      where: { id: ids.order, customerId: ids.customer },
    });
    await tx.seller.deleteMany({
      where: { id: ids.seller, userId: ids.sellerUser },
    });
    await tx.customerProfile.deleteMany({
      where: { id: ids.customer, userId: ids.customerUser },
    });
    await tx.user.deleteMany({
      where: {
        id: { in: [ids.customerUser, ids.sellerUser] },
        normalizedEmail: {
          in: [
            "delivery-queue-customer@local.invalid",
            "delivery-queue-seller@local.invalid",
          ],
        },
      },
    });
  });
}

test("real worker uses service and PostgreSQL for exactly one fixture transition and cleans its graph", async (t) => {
  const env = await environment(t);
  // Refuse preexisting IDs; never treat existing data as disposable fixtures.
  assert.equal(
    await prisma.user.count({
      where: { id: { in: [ids.customerUser, ids.sellerUser] } },
    }),
    0,
  );
  assert.equal(await prisma.delivery.count({ where: { id: ids.delivery } }), 0);
  let prepared = false;
  let worker;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.createMany({
        data: [
          {
            id: ids.customerUser,
            name: "Queue Test Customer",
            email: "delivery-queue-customer@local.invalid",
            normalizedEmail: "delivery-queue-customer@local.invalid",
            password: "not-a-login-password",
            role: "CUSTOMER",
          },
          {
            id: ids.sellerUser,
            name: "Queue Test Seller",
            email: "delivery-queue-seller@local.invalid",
            normalizedEmail: "delivery-queue-seller@local.invalid",
            password: "not-a-login-password",
            role: "SELLER",
          },
        ],
      });
      await tx.customerProfile.create({
        data: { id: ids.customer, userId: ids.customerUser },
      });
      await tx.seller.create({
        data: {
          id: ids.seller,
          userId: ids.sellerUser,
          storeName: "Queue Test Seller",
        },
      });
      await tx.order.create({
        data: {
          id: ids.order,
          customerId: ids.customer,
          status: "CONFIRMED",
          subtotalInCents: 0,
          totalInCents: 0,
          currency: "BRL",
          confirmedAt: new Date(),
        },
      });
      await tx.sellerOrder.create({
        data: {
          id: ids.sellerOrder,
          orderId: ids.order,
          sellerId: ids.seller,
          status: "CONFIRMED",
          subtotalInCents: 0,
          totalInCents: 0,
          currency: "BRL",
        },
      });
      await tx.delivery.create({
        data: {
          id: ids.delivery,
          sellerOrderId: ids.sellerOrder,
          status: "SEPARATED",
        },
      });
      await tx.deliveryStatusHistory.create({
        data: {
          id: ids.history,
          deliveryId: ids.delivery,
          toStatus: "SEPARATED",
          changedAt: new Date(Date.now() - 5 * 3600000),
        },
      });
    });
    prepared = true;
    worker = env.start(); // Actual default processDeliveryProgressionJob -> service -> repository.
    const data = payload(ids.delivery);
    data.expectedHistoryId = ids.history;
    await publishDeliveryJobs(env.queue, one(data), quiet);
    const completed = await state(
      env.queue,
      deliveryProgressionJobId(data),
      "completed",
    );
    assert.equal(completed.returnvalue.outcome, "applied");
    assert.equal(
      (await prisma.delivery.findUnique({ where: { id: ids.delivery } }))
        .status,
      "PROCESSING",
    );
    const history = await prisma.deliveryStatusHistory.findMany({
      where: { deliveryId: ids.delivery },
      orderBy: { changedAt: "asc" },
    });
    assert.equal(history.length, 2);
    assert.equal(history[1].fromStatus, "SEPARATED");
    assert.equal(history[1].toStatus, "PROCESSING");
    assert.equal(require.cache[require.resolve("../dist/server")], undefined);
  } finally {
    if (worker) {
      assert.equal(
        await closeDeliveryWorker(worker, async () => {}, 5000, quiet),
        true,
      );
    }
    if (prepared) {
      await cleanupFixture();
    }
  }
  assert.equal(await prisma.delivery.count({ where: { id: ids.delivery } }), 0);
  assert.equal(await prisma.order.count({ where: { id: ids.order } }), 0);
  assert.equal(
    await prisma.user.count({
      where: { id: { in: [ids.customerUser, ids.sellerUser] } },
    }),
    0,
  );
});
