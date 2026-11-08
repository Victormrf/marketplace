const test = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const { createLogger } = require("../dist/utils/logger");
const {
  parseDiscoveryJob,
  discoveryInterval,
  discoveryProcessor,
  configureDiscoveryScheduler,
  removeDiscoveryScheduler,
  DISCOVERY_JOB,
  DISCOVERY_SCHEDULER,
} = require("../dist/jobs/deliveryDiscovery");
const {
  DeliveryRetryableError,
  DeliveryTerminalError,
} = require("../dist/jobs/deliveryQueue");

function capturedLog() {
  const records = [];
  return {
    records,
    log: createLogger({ sink: (line) => records.push(JSON.parse(line)) }),
  };
}

test("discovery contract accepts only version 1 without arbitrary query or data", () => {
  assert.deepEqual(parseDiscoveryJob({ version: 1 }), { version: 1 });
  for (const value of [
    null,
    [],
    {},
    { version: 2 },
    { version: 1, deliveryId: "private" },
  ]) {
    assert.throws(() => parseDiscoveryJob(value));
  }
});

test("operational interval defaults to five minutes and cannot bypass one-minute floor", () => {
  assert.equal(discoveryInterval({}), 300000);
  assert.equal(
    discoveryInterval({ DELIVERY_DISCOVERY_INTERVAL_MS: "60000" }),
    60000,
  );
  for (const value of ["0", "1000", "60000.5", "NaN", "86400001"]) {
    assert.throws(() =>
      discoveryInterval({
        NODE_ENV: "test",
        DELIVERY_DISCOVERY_INTERVAL_MS: value,
      }),
    );
  }
});

test("configuration upserts the same scheduler identity and removal targets only it", async () => {
  const { log, records } = capturedLog();
  const calls = [];
  const queue = {
    async upsertJobScheduler(...args) {
      calls.push(args);
    },
    async removeJobScheduler(id) {
      assert.equal(id, DISCOVERY_SCHEDULER);
      return true;
    },
  };
  await configureDiscoveryScheduler(queue, 300000, log);
  await configureDiscoveryScheduler(queue, 60000, log);
  assert.equal(calls[0][0], calls[1][0]);
  assert.deepEqual(calls[1][1], { every: 60000 });
  assert.deepEqual(calls[1][2].data, { version: 1 });
  assert.equal(calls[1][2].opts.attempts, 3);
  await assert.rejects(() => configureDiscoveryScheduler(queue, 10, log));
  assert.equal(calls.length, 2);
  assert.equal(await removeDiscoveryScheduler(queue, log), true);
  assert.deepEqual(
    records.map((record) => record.event),
    [
      "delivery.discovery.configured",
      "delivery.discovery.configured",
      "delivery.discovery.removed",
    ],
  );
});

test("discovery streams candidates sequentially through deterministic existing publisher", async () => {
  const { log, records } = capturedLog();
  let confirmed = 0;
  async function* discover() {
    for (let index = 0; index < 3; index++) {
      assert.equal(confirmed, index);
      yield {
        version: 1,
        deliveryId: `delivery-${index}`,
        expectedHistoryId: `history-${index}`,
        expectedStatus: "SEPARATED",
        eligibleBefore: "2026-11-08T00:00:00.000Z",
      };
    }
  }
  const processor = discoveryProcessor(
    {
      async add(name, data, opts) {
        assert.equal(name, "advance-delivery-v1");
        assert.match(opts.jobId, /^delivery-progression-v1-[a-f0-9]{64}$/);
        assert.equal(data.deliveryId, `delivery-${confirmed}`);
        confirmed++;
      },
    },
    discover,
    log,
  );
  assert.deepEqual(
    await processor({
      name: DISCOVERY_JOB,
      data: { version: 1 },
      attemptsMade: 0,
    }),
    {
      confirmedPublications: 3,
    },
  );
  assert.equal(records[0].event, "delivery.discovery.started");
  assert.equal(records.at(-1).event, "delivery.discovery.completed");
  assert.equal(records.at(-1).context.count, 3);
});

test("only classified transient Prisma failures retry; unknown errors are terminal and sanitized", async () => {
  const { log, records } = capturedLog();
  let original;
  async function* discover() {
    throw original;
  }
  const processor = discoveryProcessor(
    {
      add() {
        assert.fail("No candidates");
      },
    },
    discover,
    log,
  );
  const job = { name: DISCOVERY_JOB, data: { version: 1 }, attemptsMade: 0 };
  original = new Prisma.PrismaClientKnownRequestError("private SQL", {
    code: "P1001",
    clientVersion: "6.11.1",
  });
  await assert.rejects(
    () => processor(job),
    (error) =>
      error instanceof DeliveryRetryableError && error.cause === original,
  );
  original = new Error("private password cookie database URL");
  await assert.rejects(
    () => processor(job),
    (error) =>
      error instanceof DeliveryTerminalError && error.cause === original,
  );
  assert.equal(
    records.some((record) => record.event === "delivery.discovery.completed"),
    false,
  );
  assert.equal(JSON.stringify(records).includes("private"), false);
  assert.deepEqual(
    records
      .filter((record) => record.event === "delivery.discovery.failed")
      .map((record) => record.context.code),
    ["DATABASE_UNAVAILABLE", "UNEXPECTED_DELIVERY_JOB_ERROR"],
  );
});

test("invalid occurrence is rejected before discovery or publication", async () => {
  const { log } = capturedLog();
  const processor = discoveryProcessor(
    {
      add() {
        assert.fail();
      },
    },
    () => {
      assert.fail();
    },
    log,
  );
  await assert.rejects(
    () =>
      processor({ name: "arbitrary", data: { version: 1 }, attemptsMade: 0 }),
    DeliveryTerminalError,
  );
  await assert.rejects(
    () =>
      processor({
        name: DISCOVERY_JOB,
        data: { version: 1, query: "private" },
        attemptsMade: 0,
      }),
    DeliveryTerminalError,
  );
});
