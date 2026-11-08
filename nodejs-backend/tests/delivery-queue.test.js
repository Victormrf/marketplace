const test = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const { UnrecoverableError } = require("bullmq");
const { createLogger } = require("../dist/utils/logger");
const {
  ConflictError,
  ValidationError,
} = require("../dist/utils/customErrors");
const {
  deliveryQueueConfig,
  DELIVERY_JOB_OPTIONS,
  DELIVERY_JOB,
  publishDeliveryJobs,
  deliveryProcessor,
  classifyDeliveryFailure,
  DeliveryRetryableError,
  DeliveryTerminalError,
  closeDeliveryWorker,
  inspectDeliveryJob,
} = require("../dist/jobs/deliveryQueue");

function payload(overrides = {}) {
  return {
    version: 1,
    deliveryId: "queue-unit-delivery",
    expectedStatus: "SEPARATED",
    expectedHistoryId: "queue-unit-history",
    eligibleBefore: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
async function* candidates() {
  yield payload();
  yield payload({ deliveryId: "queue-unit-second" });
}
function capture() {
  const records = [];
  const log = createLogger({ sink: (line) => records.push(JSON.parse(line)) });
  return { log, records };
}
const transient = (code = "P1001") =>
  new Prisma.PrismaClientKnownRequestError("private SQL password", {
    code,
    clientVersion: "6.11.1",
  });

test("explicit queue configuration validates destination, namespace and bounded concurrency", () => {
  const config = deliveryQueueConfig({
    DELIVERY_REDIS_URL: "redis://127.0.0.1:6381/15",
  });
  assert.equal(config.concurrency, 1);
  assert.equal(config.connection.port, 6381);
  assert.equal(config.connection.db, 15);
  for (const environment of [
    {},
    { DELIVERY_REDIS_URL: "http://localhost" },
    { DELIVERY_REDIS_URL: "redis:///0" },
    { DELIVERY_REDIS_URL: "redis://localhost/16" },
    {
      DELIVERY_REDIS_URL: "redis://localhost/0",
      DELIVERY_WORKER_CONCURRENCY: "5",
    },
    {
      DELIVERY_REDIS_URL: "redis://localhost/0",
      DELIVERY_WORKER_CONCURRENCY: "1.5",
    },
    {
      DELIVERY_REDIS_URL: "redis://localhost/0",
      DELIVERY_QUEUE_PREFIX: "unsafe:prefix",
    },
  ]) {
    assert.throws(() => deliveryQueueConfig(environment), ValidationError);
  }
  assert.equal(DELIVERY_JOB_OPTIONS.attempts, 3);
  assert.deepEqual(DELIVERY_JOB_OPTIONS.backoff, {
    type: "exponential",
    delay: 1000,
  });
  assert.ok(DELIVERY_JOB_OPTIONS.removeOnFail.count <= 500);
  assert.ok(DELIVERY_JOB_OPTIONS.removeOnComplete.count <= 1000);
});

test("publication awaits each acknowledgement and finishes only after all confirmations", async () => {
  const { log, records } = capture();
  let release;
  let calls = 0;
  let start;
  const started = new Promise((resolve) => {
    start = resolve;
  });
  const running = publishDeliveryJobs(
    {
      async add(name, data, options) {
        calls++;
        assert.equal(name, DELIVERY_JOB);
        assert.equal(options.attempts, 3);
        assert.match(options.jobId, /^delivery-progression-v1-[a-f0-9]{64}$/);
        if (calls === 1) {
          start();
          await new Promise((resolve) => {
            release = resolve;
          });
        }
      },
    },
    candidates(),
    log,
  );
  await started;
  assert.equal(calls, 1);
  assert.equal(records.length, 0);
  release();
  assert.equal(await running, 2);
  assert.equal(
    records.filter((record) => record.event === "delivery.job.published")
      .length,
    2,
  );
  assert.equal(records.at(-1).context.count, 2);
});

test("publication failure or interruption stops without another candidate or false completion", async () => {
  const { log, records } = capture();
  const original = new Error("private Redis URL");
  let calls = 0;
  await assert.rejects(
    publishDeliveryJobs(
      {
        async add() {
          calls++;
          throw original;
        },
      },
      candidates(),
      log,
    ),
    (error) => error === original,
  );
  assert.equal(calls, 1);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    publishDeliveryJobs(
      {
        async add() {
          assert.fail("Must not publish");
        },
      },
      candidates(),
      log,
      abort.signal,
    ),
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].context.code, "QUEUE_PUBLICATION_FAILED");
  assert.match(
    records[0].context.jobId,
    /^delivery-progression-v1-[a-f0-9]{64}$/,
  );
  assert.ok(!JSON.stringify(records).includes("private"));
});

test("processor uses v1 function for applied and ignored without returning a Delivery DTO", async () => {
  for (const outcome of ["applied", "ignored"]) {
    const { log, records } = capture();
    let calls = 0;
    const processor = deliveryProcessor(async (input) => {
      calls++;
      assert.deepEqual(input, payload());
      return { deliveryId: input.deliveryId, outcome, privateField: "private" };
    }, log);
    const result = await processor({
      name: DELIVERY_JOB,
      data: payload(),
      attemptsMade: 0,
    });
    assert.deepEqual(result, { deliveryId: payload().deliveryId, outcome });
    assert.equal(calls, 1);
    assert.equal(records[0].context.jobOutcome, outcome);
  }
});

test("invalid name, version or payload is terminal and never reaches service", async () => {
  const { log, records } = capture();
  const processor = deliveryProcessor(
    async () => assert.fail("Must not process"),
    log,
  );
  for (const job of [
    { name: "unapproved-name", data: payload(), attemptsMade: 0 },
    { name: DELIVERY_JOB, data: payload({ version: 2 }), attemptsMade: 0 },
    {
      name: DELIVERY_JOB,
      data: payload({ email: "private-email" }),
      attemptsMade: 0,
    },
  ]) {
    await assert.rejects(
      processor(job),
      (error) =>
        error instanceof UnrecoverableError &&
        error.cause instanceof ValidationError,
    );
  }
  assert.ok(
    records.every((record) => record.context.code === "INVALID_DELIVERY_JOB"),
  );
  assert.ok(!JSON.stringify(records).includes("private-email"));
});

test("only recognized Prisma types/codes are retryable, unknown conflicts remain terminal", async () => {
  const { log } = capture();
  for (const code of ["P1001", "P1017", "P1002", "P1008", "P2024", "P2034"]) {
    const original = transient(code);
    const processor = deliveryProcessor(async () => {
      throw original;
    }, log);
    await assert.rejects(
      processor({ name: DELIVERY_JOB, data: payload(), attemptsMade: 0 }),
      (error) =>
        error instanceof DeliveryRetryableError && error.cause === original,
    );
    assert.equal(classifyDeliveryFailure(original).transient, true);
  }
  for (const original of [
    new Error("timeout private"),
    new ConflictError("concurrent private"),
    { code: "P1001" },
    transient("P2028"),
  ]) {
    const processor = deliveryProcessor(async () => {
      throw original;
    }, log);
    await assert.rejects(
      processor({ name: DELIVERY_JOB, data: payload(), attemptsMade: 0 }),
      (error) =>
        error instanceof DeliveryTerminalError && error.cause === original,
    );
  }
});

test("logs and queue failure strings omit original errors, stacks and arbitrary fields", async () => {
  const { log, records } = capture();
  const original = new Error(
    "postgresql://private-password SQL private-address",
  );
  const processor = deliveryProcessor(async () => {
    throw original;
  }, log);
  await assert.rejects(
    processor({
      name: DELIVERY_JOB,
      data: payload(),
      id: "private-token",
      attemptsMade: 0,
    }),
    (error) => {
      assert.equal(error.cause, original);
      assert.equal(error.stack, "UNEXPECTED_DELIVERY_JOB_ERROR");
      assert.ok(!JSON.stringify(error).includes("private"));
      return true;
    },
  );
  log.error("delivery.job.failed", {
    code: "UNKNOWN_CODE",
    jobId: "private-cookie",
    jobOutcome: "UNKNOWN",
    payload: original,
  });
  assert.ok(!JSON.stringify(records).includes("private"));
  assert.equal(records.at(-1).context.code, undefined);
  assert.equal(records.at(-1).context.jobId, undefined);
});

test("worker shutdown waits active processing before database disconnect", async () => {
  const { log, records } = capture();
  let release;
  let databaseClosed = false;
  const closing = closeDeliveryWorker(
    {
      async close() {
        await new Promise((resolve) => {
          release = resolve;
        });
      },
      async disconnect() {
        assert.fail("No forced disconnect needed");
      },
    },
    async () => {
      databaseClosed = true;
    },
    1000,
    log,
  );
  assert.equal(databaseClosed, false);
  release();
  assert.equal(await closing, true);
  assert.equal(databaseClosed, true);
  assert.equal(records.at(-1).event, "delivery.worker.stopped");
});

test("shutdown deadline is explicit and closes connections without claiming graceful success", async () => {
  const { log, records } = capture();
  let redisClosed = false;
  let databaseClosed = false;
  const normal = await closeDeliveryWorker(
    {
      async close() {
        await new Promise(() => {});
      },
      async disconnect() {
        redisClosed = true;
      },
    },
    async () => {
      databaseClosed = true;
    },
    20,
    log,
  );
  assert.equal(normal, false);
  assert.equal(redisClosed, true);
  assert.equal(databaseClosed, true);
  assert.equal(records.at(-1).context.code, "WORKER_SHUTDOWN_INCOMPLETE");
});

test("single-job inspection validates identity and handles absence without exposing payload", async () => {
  let calls = 0;
  const queue = {
    async getJob() {
      calls++;
      return undefined;
    },
  };
  await assert.rejects(
    inspectDeliveryJob(queue, "private-user"),
    ValidationError,
  );
  assert.equal(calls, 0);
  const id = `delivery-progression-v1-${"a".repeat(64)}`;
  assert.deepEqual(await inspectDeliveryJob(queue, id), {
    id,
    state: "missing",
  });
});

test("inspection exposes only state, counters and known safe results/codes", async () => {
  const id = `delivery-progression-v1-${"a".repeat(64)}`;
  const queue = {
    async getJob() {
      return {
        getState: async () => "failed",
        attemptsMade: 1,
        attemptsStarted: 1,
        failedReason: "private error SQL password",
        data: { privateField: "private-value" },
        returnvalue: { outcome: "private-result" },
        stacktrace: ["private-stack"],
      };
    },
  };
  const result = await inspectDeliveryJob(queue, id);
  assert.equal(result.state, "failed");
  assert.equal(result.attempts, 1);
  assert.equal(result.code, undefined);
  assert.equal(result.outcome, undefined);
  assert.ok(!JSON.stringify(result).includes("private"));
});
