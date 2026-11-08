const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const {
  prisma,
  redisUrl,
  prepareFixtures,
  discoverFixtures,
  snapshot,
} = require("./helpers/delivery-recovery-fixture");
const { createLogger } = require("../dist/utils/logger");
const {
  deliveryQueueConfig,
  createDeliveryQueue,
  createDeliveryWorker,
  closeDeliveryWorker,
  queueDeadline,
  DELIVERY_JOB_OPTIONS,
} = require("../dist/jobs/deliveryQueue");
const {
  DISCOVERY_JOB,
  DISCOVERY_SCHEDULER,
  createDiscoveryQueue,
  createDiscoveryWorker,
  configureDiscoveryScheduler,
  removeDiscoveryScheduler,
} = require("../dist/jobs/deliveryDiscovery");

const quiet = createLogger({ sink() {} });

async function until(check, description) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) {
      return result;
    }
    await delay(25);
  }
  throw new Error(`Timed out: ${description}`);
}

function gate() {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function environment(t) {
  const config = deliveryQueueConfig({
    DELIVERY_REDIS_URL: redisUrl.toString(),
    DELIVERY_QUEUE_PREFIX: `discovery-test-${randomUUID()}`,
  });
  const discovery = createDiscoveryQueue(config, quiet);
  const progression = createDeliveryQueue(config, quiet);
  const workers = [];
  const gates = [];
  t.after(async () => {
    gates.forEach((barrier) => barrier.release());
    await removeDiscoveryScheduler(discovery, quiet);
    for (const worker of workers) {
      assert.equal(
        await closeDeliveryWorker(worker, async () => {}, 5000, quiet),
        true,
      );
    }
    await discovery.obliterate({ force: false });
    await progression.obliterate({ force: false });
    const client = await discovery.client;
    assert.equal((await client.keys(`${config.prefix}:*`)).length, 0);
    await Promise.all([discovery.close(), progression.close()]);
    assert.equal(client.status, "end");
  });
  await Promise.all([
    queueDeadline(discovery.waitUntilReady(), 5000),
    queueDeadline(progression.waitUntilReady(), 5000),
  ]);
  const client = await discovery.client;
  const settings = await client.config("GET", "appendonly", "maxmemory-policy");
  assert.ok(settings.includes("yes"));
  assert.ok(settings.includes("noeviction"));
  return {
    config,
    discovery,
    progression,
    gates,
    async startDiscovery(discover) {
      const worker = await createDiscoveryWorker(
        config,
        discovery,
        progression,
        discover,
        quiet,
      );
      workers.push(worker);
      await worker.waitUntilReady();
      worker.run().catch(() => {});
      return worker;
    },
    async startProgression() {
      const worker = createDeliveryWorker(config, undefined, quiet);
      workers.push(worker);
      await worker.waitUntilReady();
      worker.run().catch(() => {});
      return worker;
    },
  };
}

test.after(() => prisma.$disconnect());

test("real scheduler upsert is unique, exposes updated interval and can be removed", async (t) => {
  const env = await environment(t);
  await configureDiscoveryScheduler(env.discovery, 300000, quiet);
  await configureDiscoveryScheduler(env.discovery, 60000, quiet);
  assert.equal(await env.discovery.getJobSchedulersCount(), 1);
  const scheduler = await env.discovery.getJobScheduler(DISCOVERY_SCHEDULER);
  assert.equal(scheduler.every, 60000);
  assert.equal(scheduler.name, DISCOVERY_JOB);
  assert.equal(await removeDiscoveryScheduler(env.discovery, quiet), true);
  assert.equal(await env.discovery.getJobSchedulersCount(), 0);
  assert.equal(await removeDiscoveryScheduler(env.discovery, quiet), false);
});

test("real scheduler → scoped discovery → publication → progression adds exactly one history", async (t) => {
  const env = await environment(t);
  const fixture = await prepareFixtures();
  // Cleanup environment (registered first) must stop workers before deleting fixture.
  // A finally below explicitly drains both workers, then performs fixture cleanup.
  let discoveryWorker;
  let progressionWorker;
  try {
    discoveryWorker = await env.startDiscovery(() => discoverFixtures(fixture));
    progressionWorker = await env.startProgression();
    await configureDiscoveryScheduler(env.discovery, 60000, quiet);
    await until(async () => {
      const current = await snapshot(fixture.deliveries[0]);
      return (
        current.delivery.status === "PROCESSING" && current.history.length === 2
      );
    }, "one persisted transition");
    await until(
      async () => (await env.discovery.getCompletedCount()) === 1,
      "discovery completion",
    );
    const jobs = await env.discovery.getJobs(["completed"]);
    assert.equal(jobs[0].returnvalue.confirmedPublications, 1);
    assert.equal(await env.progression.getCompletedCount(), 1);
    const current = await snapshot(fixture.deliveries[0]);
    assert.equal(current.history[1].fromStatus, "SEPARATED");
    assert.equal(current.history[1].toStatus, "PROCESSING");
    t.diagnostic(
      "Real Redis schedule and both workers applied one transition; discovery restricted to fixture IDs.",
    );
  } finally {
    await removeDiscoveryScheduler(env.discovery, quiet);
    await discoveryWorker?.close();
    await progressionWorker?.close();
    await fixture.cleanup();
  }
});

test("Redis global concurrency prevents overlap across two discovery worker instances", async (t) => {
  const env = await environment(t);
  const barrier = gate();
  env.gates.push(barrier);
  let active = 0;
  let maximum = 0;
  let starts = 0;
  async function* discover() {
    starts++;
    active++;
    maximum = Math.max(maximum, active);
    try {
      if (starts === 1) {
        await barrier.promise;
      }
    } finally {
      active--;
    }
  }
  await env.startDiscovery(discover);
  await env.startDiscovery(discover);
  assert.equal(await env.discovery.getGlobalConcurrency(), 1);
  await env.discovery.add(DISCOVERY_JOB, { version: 1 }, { jobId: "first" });
  await until(() => starts === 1, "first consumer entered");
  await env.discovery.add(DISCOVERY_JOB, { version: 1 }, { jobId: "second" });
  await until(
    async () => (await env.discovery.getWaitingCount()) === 1,
    "second occurrence waiting",
  );
  assert.equal(await env.discovery.getActiveCount(), 1);
  assert.equal(starts, 1);
  barrier.release();
  await until(
    async () => (await env.discovery.getCompletedCount()) === 2,
    "both occurrences finished",
  );
  assert.equal(starts, 2);
  assert.equal(maximum, 1);
});

test("no discovery consumers during multiple intervals does not accumulate missed occurrences", async (t) => {
  const env = await environment(t);
  // Short intervals exist only in this isolated test, never operational config.
  await env.discovery.upsertJobScheduler(
    DISCOVERY_SCHEDULER,
    { every: 100 },
    {
      name: DISCOVERY_JOB,
      data: { version: 1 },
      opts: DELIVERY_JOB_OPTIONS,
    },
  );
  const started = Date.now();
  await until(async () => {
    const counts = await env.discovery.getJobCounts(
      "waiting",
      "delayed",
      "active",
    );
    assert.ok(counts.waiting + counts.delayed + counts.active <= 1);
    return Date.now() - started >= 650;
  }, "several intervals with unavailable consumers");
  let calls = 0;
  const entered = gate();
  const release = gate();
  env.gates.push(release);
  await env.startDiscovery(async function* () {
    calls++;
    entered.release();
    await release.promise;
  });
  await queueDeadline(entered.promise, 5000);
  await removeDiscoveryScheduler(env.discovery, quiet);
  release.release();
  await until(
    async () => (await env.discovery.getActiveCount()) === 0,
    "drain after removal",
  );
  assert.equal(calls, 1);
  assert.equal(await env.discovery.getJobSchedulersCount(), 0);
});

test("later recurring discovery recovers partial publication without retrying the terminal occurrence", async (t) => {
  const env = await environment(t);
  let attempts = 0;
  const candidates = [0, 1].map((index) => ({
    version: 1,
    deliveryId: `discovery-fixture-${index}`,
    expectedHistoryId: `discovery-history-${index}`,
    expectedStatus: "SEPARATED",
    eligibleBefore: "2026-11-08T00:00:00.000Z",
  }));
  const progression = {
    async add(...args) {
      attempts++;
      if (attempts === 2) {
        throw new Error("Publication interrupted in test only");
      }
      return env.progression.add(...args);
    },
  };
  const worker = await createDiscoveryWorker(
    env.config,
    env.discovery,
    progression,
    async function* () {
      yield* candidates;
    },
    quiet,
  );
  try {
    await worker.waitUntilReady();
    worker.run().catch(() => {});
    await env.discovery.upsertJobScheduler(
      DISCOVERY_SCHEDULER,
      { every: 100 },
      {
        name: DISCOVERY_JOB,
        data: { version: 1 },
        opts: DELIVERY_JOB_OPTIONS,
      },
    );
    await until(
      async () => (await env.discovery.getFailedCount()) === 1,
      "terminal partial publication",
    );
    await until(
      async () => (await env.discovery.getCompletedCount()) >= 1,
      "next recurring discovery",
    );
    await removeDiscoveryScheduler(env.discovery, quiet);
    await worker.close();
    assert.equal(await env.progression.getWaitingCount(), 2);
    const failed = await env.discovery.getJobs(["failed"]);
    assert.equal(failed.length, 1);
    assert.equal(failed[0].attemptsMade, 1);
    assert.equal(failed[0].failedReason, "UNEXPECTED_DELIVERY_JOB_ERROR");
  } finally {
    await removeDiscoveryScheduler(env.discovery, quiet);
    await worker.close();
  }
});
