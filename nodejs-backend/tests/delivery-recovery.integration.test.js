const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { fork } = require("node:child_process");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const {
  prisma,
  databaseUrl,
  redisUrl,
  prepareFixtures,
  discoverFixtures,
  snapshot,
  oneContract,
} = require("./helpers/delivery-recovery-fixture");
const {
  createLeaseTestWorker,
} = require("./helpers/delivery-commit-before-ack");
const { createLogger } = require("../dist/utils/logger");
const {
  DeliveryRepository,
} = require("../dist/repositories/deliveryRepository");
const { DeliveryService } = require("../dist/services/deliveryService");
const {
  processDeliveryProgressionJob,
} = require("../dist/jobs/deliveryProgression");
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
async function* one(payload) {
  yield payload;
}
function gate() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function state(queue, id, expected) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const job = await queue.getJob(id);
    if (job && (await job.getState()) === expected) {
      return queue.getJob(id);
    }
    await delay(25);
  }
  throw new Error(`Test job did not reach ${expected}`);
}
function message(child, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => finish(new Error("Isolated worker proof deadline")),
      12000,
    );
    const received = (value) => {
      if (value?.type === type) {
        finish(null, value);
      }
      if (value?.type === "worker-failed") {
        finish(new Error("Isolated worker failed"));
      }
    };
    const exited = () =>
      finish(new Error("Isolated worker exited before proof"));
    function finish(error, value) {
      clearTimeout(timer);
      child.off("message", received);
      child.off("exit", exited);
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    }
    child.on("message", received);
    child.once("exit", exited);
  });
}
async function setup(t, count = 1) {
  const prefix = `delivery-recovery-test-${randomUUID()}`;
  const config = deliveryQueueConfig({
    DELIVERY_REDIS_URL: redisUrl.toString(),
    DELIVERY_QUEUE_PREFIX: prefix,
  });
  const queue = createDeliveryQueue(config, quiet);
  const workers = [];
  const children = [];
  const releases = [];
  let fixture;
  t.after(async () => {
    releases.forEach((release) => release());
    for (const entry of children) {
      if (entry.child.exitCode === null && entry.child.signalCode === null) {
        entry.child.kill("SIGKILL");
      }
      await queueDeadline(entry.exited, 5000);
    }
    for (const worker of workers) {
      assert.equal(
        await closeDeliveryWorker(worker, async () => {}, 5000, quiet),
        true,
      );
    }
    try {
      assert.match(prefix, /^delivery-recovery-test-[0-9a-f-]{36}$/);
      // Only this test's namespace, after all its workers/processes are stopped.
      // force also permits cleanup if an interrupted test left an active entry.
      await queue.obliterate({ force: true });
      assert.equal((await (await queue.client).keys(`${prefix}:*`)).length, 0);
    } finally {
      await queue.close();
      if (fixture) {
        await fixture.cleanup();
      }
    }
  });
  await queueDeadline(queue.waitUntilReady(), 5000);
  const redis = await queue.client;
  assert.equal(await redis.ping(), "PONG");
  const settings = await redis.config("GET", "appendonly", "maxmemory-policy");
  assert.ok(settings.includes("yes") && settings.includes("noeviction"));
  fixture = await prepareFixtures(count);
  return {
    prefix,
    queue,
    fixture,
    releases,
    start(processJob, lease = false) {
      const worker = lease
        ? createLeaseTestWorker(config, processJob)
        : createDeliveryWorker(config, processJob, quiet);
      workers.push(worker);
      void worker.run().catch(() => {});
      return worker;
    },
    child() {
      const child = fork(
        path.join(__dirname, "helpers/delivery-commit-before-ack.js"),
        [],
        {
          env: {
            ...process.env,
            TEST_DELIVERY_DATABASE_URL: databaseUrl.toString(),
            TEST_DELIVERY_REDIS_URL: redisUrl.toString(),
            DELIVERY_QUEUE_PREFIX: prefix,
          },
          stdio: ["ignore", "ignore", "ignore", "ipc"],
          windowsHide: true,
          execArgv: [],
        },
      );
      const exited = new Promise((resolve) =>
        child.once("exit", (code, signal) => resolve({ code, signal })),
      );
      children.push({ child, exited });
      return { child, exited };
    },
  };
}
async function appliedOnce(record) {
  const current = await snapshot(record);
  assert.equal(current.delivery.status, "PROCESSING");
  assert.equal(current.history.length, 2);
  assert.equal(current.history[0].id, record.historyId);
  assert.equal(current.history[1].fromStatus, "SEPARATED");
  assert.equal(current.history[1].toStatus, "PROCESSING");
  return current;
}
test.after(async () => {
  await prisma.$disconnect();
});

test("partial publication is recovered by scoped rediscovery without duplicate retained jobs", async (t) => {
  const env = await setup(t, 2);
  const records = [];
  const log = createLogger({ sink: (line) => records.push(JSON.parse(line)) });
  let submitted = 0;
  const failure = new Error("Controlled publication interruption");
  await assert.rejects(
    publishDeliveryJobs(
      {
        async add(...args) {
          submitted++;
          if (submitted === 2) {
            throw failure;
          }
          return env.queue.add(...args);
        },
      },
      discoverFixtures(env.fixture),
      log,
    ),
    (error) => error === failure,
  );
  assert.equal(await env.queue.getWaitingCount(), 1);
  assert.equal(
    records.filter((record) => record.event === "delivery.job.published")
      .length,
    1,
  );
  assert.ok(
    !records.some(
      (record) => record.event === "delivery.publication.completed",
    ),
  );
  for (const record of env.fixture.deliveries) {
    const before = await snapshot(record);
    assert.equal(before.delivery.status, "SEPARATED");
    assert.equal(before.history.length, 1);
  }
  assert.equal(
    await publishDeliveryJobs(env.queue, discoverFixtures(env.fixture), quiet),
    2,
  );
  assert.equal(await env.queue.getWaitingCount(), 2);
  env.start();
  for (const record of env.fixture.deliveries) {
    const id = deliveryProgressionJobId({
      version: 1,
      deliveryId: record.deliveryId,
      expectedStatus: "SEPARATED",
      expectedHistoryId: record.historyId,
      eligibleBefore: new Date().toISOString(),
    });
    assert.equal(
      (await state(env.queue, id, "completed")).returnvalue.outcome,
      "applied",
    );
    await appliedOnce(record);
  }
  t.diagnostic(
    "1 confirmed before interruption; rediscovery confirmed 2 submissions, retained only 2 identities; 2 transitions/2 additional histories.",
  );
});

test("lost publication response is reconciled using the same identity and rediscovery", async (t) => {
  const env = await setup(t);
  const payload = await oneContract(env.fixture);
  const id = deliveryProgressionJobId(payload);
  const records = [];
  const log = createLogger({ sink: (line) => records.push(JSON.parse(line)) });
  const failure = new Error("Controlled response loss after real Redis add");
  await assert.rejects(
    publishDeliveryJobs(
      {
        async add(...args) {
          await env.queue.add(...args);
          throw failure;
        },
      },
      one(payload),
      log,
    ),
    (error) => error === failure,
  );
  assert.equal(await (await env.queue.getJob(id)).getState(), "waiting");
  assert.equal(
    records.some((record) => record.event === "delivery.job.published"),
    false,
  );
  assert.equal(
    records.find((record) => record.context.code === "QUEUE_PUBLICATION_FAILED")
      .context.jobId,
    id,
  );
  assert.equal(
    await publishDeliveryJobs(env.queue, discoverFixtures(env.fixture), quiet),
    1,
  );
  assert.equal(await env.queue.getWaitingCount(), 1);
  env.start();
  assert.equal(
    (await state(env.queue, id, "completed")).returnvalue.outcome,
    "applied",
  );
  await appliedOnce(env.fixture.deliveries[0]);
  t.diagnostic(
    "Redis stored the job before simulated response loss; rediscovery reused its ID; one transition and one additional history.",
  );
});

test("two workers process equivalent identities once, including an old message republished after removal", async (t) => {
  const env = await setup(t);
  const payload = await oneContract(env.fixture);
  const id = deliveryProgressionJobId(payload);
  const alias = `${id}-equivalent`;
  await publishDeliveryJobs(env.queue, one(payload), quiet);
  await env.queue.add(DELIVERY_JOB, payload, {
    ...DELIVERY_JOB_OPTIONS,
    jobId: alias,
  });
  const both = gate();
  const release = gate();
  env.releases.push(release.release);
  const entered = new Set();
  for (const name of ["worker-a", "worker-b"]) {
    env.start(async (input) => {
      entered.add(name);
      if (entered.size === 2) {
        both.release();
      }
      await release.promise;
      return processDeliveryProgressionJob(input);
    });
  }
  await queueDeadline(both.promise, 5000);
  assert.equal(entered.size, 2);
  release.release();
  const first = await state(env.queue, id, "completed");
  const second = await state(env.queue, alias, "completed");
  assert.deepEqual(
    [first.returnvalue.outcome, second.returnvalue.outcome].sort(),
    ["applied", "ignored"],
  );
  const after = await appliedOnce(env.fixture.deliveries[0]);
  await first.remove(); // Only this completed test job, not the queue or Redis.
  assert.equal(await env.queue.getJob(id), undefined);
  await publishDeliveryJobs(env.queue, one(payload), quiet);
  assert.equal(
    (await state(env.queue, id, "completed")).returnvalue.outcome,
    "ignored",
  );
  assert.deepEqual(await snapshot(env.fixture.deliveries[0]), after);
  t.diagnostic(
    "Two distinct workers entered before release; different queue IDs yielded applied/ignored. Removed/recreated old ID also yielded ignored, history still 2.",
  );
});

test("worker is killed after PostgreSQL commit and before ack; stalled redelivery is ignored", async (t) => {
  const env = await setup(t);
  const payload = await oneContract(env.fixture);
  const id = deliveryProgressionJobId(payload);
  const isolated = env.child();
  await message(isolated.child, "ready");
  const committed = message(isolated.child, "committed");
  await publishDeliveryJobs(env.queue, one(payload), quiet);
  assert.equal((await committed).outcome, "applied");
  // Independent connection confirms visibility of the committed transaction.
  const afterCommit = await appliedOnce(env.fixture.deliveries[0]);
  const beforeAck = await env.queue.getJob(id);
  assert.equal(await beforeAck.getState(), "active");
  assert.equal(beforeAck.attemptsMade, 0);
  assert.ok(
    (await (await env.queue.client).pttl(`${env.queue.toKey(id)}:lock`)) > 0,
  );
  assert.equal(isolated.child.kill("SIGKILL"), true);
  await queueDeadline(isolated.exited, 5000);
  const recovery = env.start(undefined, true);
  const stalled = [];
  recovery.on("stalled", (jobId) => stalled.push(jobId));
  const completed = await state(env.queue, id, "completed");
  assert.equal(completed.returnvalue.outcome, "ignored");
  assert.equal(completed.attemptsStarted, 2);
  assert.ok(stalled.includes(id));
  assert.deepEqual(await snapshot(env.fixture.deliveries[0]), afterCommit);
  t.diagnostic(
    "Child reported applied; parent PostgreSQL read confirmed commit while Redis was active with 0 acks. SIGKILL exit confirmed; real stalled redelivery started twice, completed ignored, history still 2.",
  );
});

test("history-write fault rolls back state and timestamp; failed remains terminal until explicit manual retry", async (t) => {
  const env = await setup(t);
  const payload = await oneContract(env.fixture);
  const id = deliveryProgressionJobId(payload);
  const before = await snapshot(env.fixture.deliveries[0]);
  const original = new Error("Controlled failure before history insertion");
  const service = new DeliveryService(
    new DeliveryRepository({
      beforeHistory() {
        throw original;
      },
    }),
  );
  const failing = env.start((input) =>
    processDeliveryProgressionJob(input, service),
  );
  await publishDeliveryJobs(env.queue, one(payload), quiet);
  const failed = await state(env.queue, id, "failed");
  assert.equal(failed.attemptsMade, 1);
  assert.equal(failed.failedReason, "UNEXPECTED_DELIVERY_JOB_ERROR");
  assert.deepEqual(await snapshot(env.fixture.deliveries[0]), before);
  assert.equal(
    await publishDeliveryJobs(env.queue, discoverFixtures(env.fixture), quiet),
    1,
  );
  assert.equal(await env.queue.getWaitingCount(), 0);
  assert.equal((await env.queue.getJob(id)).attemptsMade, 1);
  assert.equal(await (await env.queue.getJob(id)).getState(), "failed");
  assert.equal(
    await closeDeliveryWorker(failing, async () => {}, 5000, quiet),
    true,
  );
  // Explicit test decision after inspecting the known fault and removing it.
  // There is no operational switch or automatic retry of this terminal failure.
  env.start();
  await failed.retry("failed");
  assert.equal(
    (await state(env.queue, id, "completed")).returnvalue.outcome,
    "applied",
  );
  await appliedOnce(env.fixture.deliveries[0]);
  t.diagnostic(
    "Update/history transaction rolled back including updatedAt. Rediscovery did not reactivate retained failed. Explicit same-ID manual retry after removing the test fault applied once.",
  );
});
