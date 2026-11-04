const test = require("node:test");
const assert = require("node:assert/strict");
const {
  AUTOMATIC_DELIVERY_STATUSES,
  parseDeliveryProgressionJob,
  deliveryProgressionJobId,
} = require("../dist/types/deliveryProgression");
const {
  discoverDeliveryProgressionJobs,
  processDeliveryProgressionJob,
} = require("../dist/jobs/deliveryProgression");
const {
  updateDeliveryStatuses,
} = require("../dist/jobs/deliveryStatusUpdater");
const {
  DeliveryRepository,
  DeliveryConcurrentChangeError,
} = require("../dist/repositories/deliveryRepository");
const { DeliveryService } = require("../dist/services/deliveryService");
const {
  ValidationError,
  ConflictError,
} = require("../dist/utils/customErrors");
const prisma = require("../dist/config/db").default;

const NOW = new Date("2026-11-03T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const cutoff = (hours) => new Date(NOW.getTime() - hours * HOUR);
function job(overrides = {}) {
  return {
    version: 1,
    deliveryId: "delivery-001",
    expectedStatus: "SEPARATED",
    expectedHistoryId: "history-001",
    eligibleBefore: cutoff(4).toISOString(),
    ...overrides,
  };
}
function candidate(id, status = "SEPARATED", changedAt = cutoff(4)) {
  return {
    id,
    sellerOrderId: "private-seller-order",
    status,
    trackingCode: "private-tracking",
    carrier: null,
    estimatedDelivery: null,
    deliveredAt: null,
    createdAt: cutoff(100),
    updatedAt: new Date(NOW),
    statusHistory: [{ id: `history-${id}`, toStatus: status, changedAt }],
  };
}
async function collect(repository) {
  const jobs = [];
  for await (const payload of discoverDeliveryProgressionJobs(
    repository,
    () => new Date(NOW),
  )) {
    jobs.push(payload);
  }
  return jobs;
}
function source(rows) {
  return {
    async findForJob(afterId, take) {
      return rows.filter((row) => !afterId || row.id > afterId).slice(0, take);
    },
  };
}

// Hard guard: these unit tests must never fall through to a real database.
const originalTransaction = prisma.$transaction;
const originalFindFirst = prisma.delivery.findFirst;
const originalFindMany = prisma.delivery.findMany;

function replaceMethod(t, target, method, implementation) {
  const original = target[method];
  target[method] = implementation;
  t.after(() => {
    target[method] = original;
  });
}

test.before(() => {
  const forbidden = async () => {
    throw new Error("Unexpected database access in unit test");
  };
  prisma.$transaction = forbidden;
  prisma.delivery.findFirst = forbidden;
  prisma.delivery.findMany = forbidden;
});
test.after(async () => {
  prisma.$transaction = originalTransaction;
  prisma.delivery.findFirst = originalFindFirst;
  prisma.delivery.findMany = originalFindMany;
  await prisma.$disconnect();
});

function transactionalDouble(t, options = {}) {
  const state = {
    delivery: candidate("delivery-001"),
    history: { id: "history-001", toStatus: "SEPARATED", changedAt: cutoff(4) },
    histories: [],
  };
  const events = [];
  let tail = Promise.resolve();
  replaceMethod(t, prisma.delivery, "findFirst", async () =>
    structuredClone(state.delivery),
  );
  replaceMethod(t, prisma, "$transaction", async (callback) => {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    const before = structuredClone(state);
    const tx = {
      $queryRaw: async (parts) => {
        assert.match(parts.join("?"), /FROM "delivery".*FOR UPDATE/);
        events.push("lock");
        options.afterLock?.(state);
        return [{ id: "delivery-001" }];
      },
      delivery: {
        findUnique: async () => {
          events.push("read");
          return structuredClone(state.delivery);
        },
        findFirst: async () => structuredClone(state.delivery),
        updateMany: async ({ where, data }) => {
          assert.ok(events.includes("lock"));
          assert.equal(where.id, state.delivery.id);
          assert.equal(where.status, state.delivery.status);
          events.push("update");
          if (options.changedConcurrently) {
            return { count: 0 };
          }
          Object.assign(state.delivery, data);
          return { count: 1 };
        },
      },
      deliveryStatusHistory: {
        findFirst: async ({ orderBy }) => {
          assert.deepEqual(orderBy, [{ changedAt: "desc" }, { id: "desc" }]);
          assert.ok(events.includes("lock"));
          events.push("history");
          return structuredClone(state.history);
        },
        create: async ({ data }) => {
          events.push("createHistory");
          state.histories.push(data);
          state.history = {
            id: "history-next",
            toStatus: data.toStatus,
            changedAt: new Date(NOW),
          };
        },
      },
    };
    try {
      const result = await callback(tx);
      events.push("commit");
      return result;
    } catch (error) {
      Object.assign(state, before);
      events.push("rollback");
      throw error;
    } finally {
      release();
    }
  });
  const repository = new DeliveryRepository(options.hooks);
  return {
    state,
    events,
    repository,
    service: new DeliveryService(repository),
  };
}

test("v1 contract serializes only expectations and accepts every automatic status", () => {
  for (const expectedStatus of AUTOMATIC_DELIVERY_STATUSES) {
    const payload = job({ expectedStatus });
    assert.deepEqual(
      parseDeliveryProgressionJob(JSON.parse(JSON.stringify(payload))),
      payload,
    );
  }
  assert.deepEqual(Object.keys(parseDeliveryProgressionJob(job())).sort(), [
    "deliveryId",
    "eligibleBefore",
    "expectedHistoryId",
    "expectedStatus",
    "version",
  ]);
});

test("invalid versions, statuses, identifiers, dates and extra data are rejected", () => {
  const missing = job();
  delete missing.expectedHistoryId;
  for (const payload of [
    null,
    [],
    "{}",
    missing,
    job({ version: 2 }),
    job({ version: "1" }),
    ...["DELIVERED", "FAILED", "RETURNED", "UNKNOWN"].map((expectedStatus) =>
      job({ expectedStatus }),
    ),
    job({ deliveryId: "" }),
    job({ deliveryId: " id " }),
    job({ expectedHistoryId: null }),
    job({ expectedHistoryId: "a".repeat(256) }),
    job({ eligibleBefore: "2026-02-30T12:00:00.000Z" }),
    job({ eligibleBefore: "2026-11-03" }),
    job({ eligibleBefore: new Date(NOW) }),
    job({ eligibleBefore: "2026-11-03T08:00:00-03:00" }),
    job({ trackingCode: "private-tracking" }),
    job({ userId: "private-user" }),
  ]) {
    assert.throws(() => parseDeliveryProgressionJob(payload), ValidationError);
  }
});

test("identity is stable across discovery times and changes with delivery/history", () => {
  const identity = deliveryProgressionJobId(job());
  assert.equal(
    identity,
    deliveryProgressionJobId(job({ eligibleBefore: cutoff(3).toISOString() })),
  );
  assert.notEqual(
    identity,
    deliveryProgressionJobId(job({ deliveryId: "delivery-002" })),
  );
  assert.notEqual(
    identity,
    deliveryProgressionJobId(job({ expectedHistoryId: "history-next" })),
  );
  assert.notEqual(
    deliveryProgressionJobId(
      job({ deliveryId: "a-b", expectedHistoryId: "c" }),
    ),
    deliveryProgressionJobId(
      job({ deliveryId: "a", expectedHistoryId: "b-c" }),
    ),
  );
  assert.match(identity, /^delivery-progression-v1-[a-f0-9]{64}$/);
});

test("discovery includes exact 4/24 hour boundaries and excludes 1 ms too recent", async () => {
  for (const status of AUTOMATIC_DELIVERY_STATUSES) {
    const hours = status === "SEPARATED" ? 4 : 24;
    const threshold = cutoff(hours);
    const jobs = await collect(
      source([
        candidate("a", status, new Date(threshold.getTime() - 1)),
        candidate("b", status, threshold),
        candidate("c", status, new Date(threshold.getTime() + 1)),
      ]),
    );
    assert.deepEqual(
      jobs.map((payload) => payload.deliveryId),
      ["a", "b"],
    );
    assert.ok(
      jobs.every(
        (payload) => payload.eligibleBefore === threshold.toISOString(),
      ),
    );
    assert.ok(!JSON.stringify(jobs).includes("private-tracking"));
  }
});

test("discovery skips missing/inconsistent histories and states without progression", async () => {
  const absent = candidate("a");
  absent.statusHistory = [];
  const inconsistent = candidate("b");
  inconsistent.statusHistory[0].toStatus = "PROCESSING";
  const rows = [
    absent,
    inconsistent,
    ...["FAILED", "DELIVERED", "RETURNED"].map((status) =>
      candidate(status, status),
    ),
  ];
  assert.deepEqual(await collect(source(rows)), []);
});

test("discovery is lazy, bounded to 100 rows and uses keyset across all pages", async () => {
  const rows = Array.from({ length: 205 }, (_, index) =>
    candidate(`delivery-${String(index).padStart(3, "0")}`),
  );
  const calls = [];
  const delegate = source(rows);
  const repository = {
    async findForJob(afterId, take) {
      calls.push({ afterId, take });
      return delegate.findForJob(afterId, take);
    },
  };
  const iterator = discoverDeliveryProgressionJobs(
    repository,
    () => new Date(NOW),
  );
  assert.equal(calls.length, 0);
  const first = await iterator.next();
  assert.equal(first.value.deliveryId, "delivery-000");
  assert.equal(calls.length, 1);
  const ids = [first.value.deliveryId];
  for await (const payload of iterator) {
    ids.push(payload.deliveryId);
  }
  assert.equal(new Set(ids).size, 205);
  assert.deepEqual(calls, [
    { afterId: null, take: 100 },
    { afterId: "delivery-099", take: 100 },
    { afterId: "delivery-199", take: 100 },
  ]);
});

test("processing calls service once with the original history and cutoff", async () => {
  const calls = [];
  const result = await processDeliveryProgressionJob(
    job(),
    {
      async advanceForJob(...args) {
        calls.push(args);
        return { id: "delivery-001", status: "PROCESSING" };
      },
    },
    NOW,
  );
  assert.deepEqual(result, { deliveryId: "delivery-001", outcome: "applied" });
  assert.deepEqual(calls, [
    ["delivery-001", "SEPARATED", cutoff(4), "history-001"],
  ]);
});

test("payload validation happens before any service operation", async () => {
  let called = false;
  await assert.rejects(
    processDeliveryProgressionJob(
      job({ version: 0 }),
      {
        async advanceForJob() {
          called = true;
        },
      },
      NOW,
    ),
    ValidationError,
  );
  assert.equal(called, false);
});

test("a supplied future cutoff cannot shorten the 4/24 hour wait", async () => {
  for (const status of AUTOMATIC_DELIVERY_STATUSES) {
    let received;
    await processDeliveryProgressionJob(
      job({
        expectedStatus: status,
        eligibleBefore: new Date(NOW.getTime() + HOUR).toISOString(),
      }),
      {
        async advanceForJob(_id, _status, threshold) {
          received = threshold;
          return null;
        },
      },
      NOW,
    );
    assert.deepEqual(received, cutoff(status === "SEPARATED" ? 4 : 24));
  }
});

test("delayed messages retain the original stricter cutoff instead of broadening it", async () => {
  let received;
  await processDeliveryProgressionJob(
    job(),
    {
      async advanceForJob(_id, _status, threshold) {
        received = threshold;
        return null;
      },
    },
    new Date(NOW.getTime() + 48 * HOUR),
  );
  assert.deepEqual(received, cutoff(4));
});

test("missing delivery or stale status is ignored without a transition", async () => {
  for (const record of [null, candidate("delivery-001", "PROCESSING")]) {
    const service = new DeliveryService({
      async findById() {
        return record;
      },
      async transition() {
        assert.fail("No transition expected");
      },
    });
    assert.equal(
      (await processDeliveryProgressionJob(job(), service, NOW)).outcome,
      "ignored",
    );
  }
});

test("repository rereads status after the lock and ignores stale selections", async (t) => {
  const { service, state, events } = transactionalDouble(t, {
    afterLock(current) {
      current.delivery.status = "SHIPPED";
    },
  });
  assert.equal(
    (await processDeliveryProgressionJob(job(), service, NOW)).outcome,
    "ignored",
  );
  assert.equal(state.histories.length, 0);
  assert.ok(!events.includes("update"));
  assert.deepEqual(events.slice(0, 2), ["read", "lock"]);
});

test("repository ignores stale or inconsistent or absent history after lock", async (t) => {
  const { service, state, events } = transactionalDouble(t);
  for (const history of [
    null,
    { id: "history-new", toStatus: "SEPARATED", changedAt: cutoff(4) },
    { id: "history-001", toStatus: "PROCESSING", changedAt: cutoff(4) },
    {
      id: "history-001",
      toStatus: "SEPARATED",
      changedAt: new Date(cutoff(4).getTime() + 1),
    },
  ]) {
    state.history = history;
    assert.equal(
      (await processDeliveryProgressionJob(job(), service, NOW)).outcome,
      "ignored",
    );
  }
  assert.equal(state.histories.length, 0);
  assert.ok(!events.includes("update"));
});

test("duplicate concurrent messages apply a single status and one history", async (t) => {
  const { service, state, events } = transactionalDouble(t);
  const outcomes = await Promise.all([
    processDeliveryProgressionJob(job(), service, NOW),
    processDeliveryProgressionJob(job(), service, NOW),
  ]);
  assert.deepEqual(outcomes.map((result) => result.outcome).sort(), [
    "applied",
    "ignored",
  ]);
  assert.equal(state.delivery.status, "PROCESSING");
  assert.equal(state.histories.length, 1);
  assert.deepEqual(state.histories[0], {
    deliveryId: "delivery-001",
    fromStatus: "SEPARATED",
    toStatus: "PROCESSING",
    reason: "Scheduled delivery progression",
  });
  assert.ok(events.indexOf("history") < events.indexOf("update"));
  assert.ok(events.indexOf("update") < events.indexOf("createHistory"));
  assert.equal(
    (await processDeliveryProgressionJob(job(), service, NOW)).outcome,
    "ignored",
  );
  assert.equal(state.histories.length, 1);
});

test("a new expected history cannot skip the next 24 hour waiting period", async (t) => {
  const { service, state } = transactionalDouble(t);
  assert.equal(
    (await processDeliveryProgressionJob(job(), service, NOW)).outcome,
    "applied",
  );
  const nextJob = job({
    expectedStatus: "PROCESSING",
    expectedHistoryId: "history-next",
    eligibleBefore: NOW.toISOString(),
  });
  assert.equal(
    (await processDeliveryProgressionJob(nextJob, service, NOW)).outcome,
    "ignored",
  );
  assert.equal(state.delivery.status, "PROCESSING");
  assert.equal(state.histories.length, 1);
});

test("each eligible status advances only to its configured next status", async (t) => {
  const { service, state } = transactionalDouble(t);
  const nextStatuses = [
    "PROCESSING",
    "SHIPPED",
    "COLLECTED",
    "ARRIVED_AT_CENTER",
    "DELIVERED",
  ];
  for (const [index, status] of AUTOMATIC_DELIVERY_STATUSES.entries()) {
    const threshold = cutoff(status === "SEPARATED" ? 4 : 24);
    state.delivery = candidate("delivery-001", status, threshold);
    state.history = {
      id: "history-001",
      toStatus: status,
      changedAt: threshold,
    };
    state.histories = [];
    const result = await processDeliveryProgressionJob(
      job({ expectedStatus: status, eligibleBefore: threshold.toISOString() }),
      service,
      NOW,
    );
    assert.equal(result.outcome, "applied");
    assert.equal(state.delivery.status, nextStatuses[index]);
    assert.equal(state.histories.length, 1);
    assert.equal(state.histories[0].fromStatus, status);
    assert.equal(state.histories[0].toStatus, nextStatuses[index]);
    if (nextStatuses[index] === "DELIVERED") {
      assert.ok(state.delivery.deliveredAt instanceof Date);
    } else {
      assert.equal(state.delivery.deliveredAt, null);
    }
  }
});

test("only the typed conditional-update race is ignored", async (t) => {
  const { service, state } = transactionalDouble(t, {
    changedConcurrently: true,
  });
  assert.equal(
    (await processDeliveryProgressionJob(job(), service, NOW)).outcome,
    "ignored",
  );
  assert.equal(state.histories.length, 0);
  for (const original of [
    new ConflictError("Invalid delivery transition"),
    new ConflictError("Delivery changed concurrently"),
    Object.assign(new Error("Unknown failure"), {
      name: "DeliveryConcurrentChangeError",
    }),
  ]) {
    await assert.rejects(
      processDeliveryProgressionJob(
        job(),
        {
          async advanceForJob() {
            throw original;
          },
        },
        NOW,
      ),
      (error) => error === original,
    );
  }
  assert.ok(new DeliveryConcurrentChangeError() instanceof ConflictError);
});

test("technical failures preserve the original error and transaction failure is not success", async (t) => {
  const original = new Error("Technical fixture failure");
  const { service, state, events } = transactionalDouble(t, {
    hooks: {
      beforeHistory() {
        throw original;
      },
    },
  });
  await assert.rejects(
    processDeliveryProgressionJob(job(), service, NOW),
    (error) => error === original,
  );
  assert.equal(state.delivery.status, "SEPARATED");
  assert.equal(state.histories.length, 0);
  assert.ok(events.includes("rollback"));
  assert.ok(!events.includes("commit"));
});

test("existing executor composes discovery and processing without a queue or HTTP server", async () => {
  const rows = Array.from({ length: 205 }, (_, index) =>
    candidate(`delivery-${String(index).padStart(3, "0")}`),
  );
  const calls = [];
  const service = {
    async advanceForJob(id, status, threshold, historyId) {
      calls.push({ id, status, threshold, historyId });
      const record = rows.find((row) => row.id === id);
      record.status = "PROCESSING";
      record.statusHistory = [
        { id: `next-${id}`, toStatus: "PROCESSING", changedAt: new Date(NOW) },
      ];
      return { id, status: "PROCESSING" };
    },
  };
  const repository = source(rows);
  await updateDeliveryStatuses(repository, service, () => new Date(NOW));
  assert.equal(calls.length, 205);
  assert.equal(new Set(calls.map((call) => call.id)).size, 205);
  assert.ok(calls.every((call) => call.status === "SEPARATED"));
  await updateDeliveryStatuses(repository, service, () => new Date(NOW));
  assert.equal(calls.length, 205);
  assert.equal(require.cache[require.resolve("../dist/server")], undefined);
});

test("executor stops on technical failure without retries or processing another message", async () => {
  const original = new Error("Unavailable dependency");
  let calls = 0;
  await assert.rejects(
    updateDeliveryStatuses(
      source([candidate("a"), candidate("b")]),
      {
        async advanceForJob() {
          calls++;
          throw original;
        },
      },
      () => new Date(NOW),
    ),
    (error) => error === original,
  );
  assert.equal(calls, 1);
});
