const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { collector, watch } = require("../load/minimal");
const { summary } = require("../load/minimal-read");
const plan = require("../load/plan.json");
const policy = { ...plan.stopPolicy, ...plan.reducedBaseline };

function sample(index, free = 700 * 1024 ** 2) {
  return {
    at: index * 1000,
    freeMemoryBytes: free,
    clock: { total: index * 100, idle: index * 80 },
    collectionMs: 1,
    storage: { windowsFreeBytes: 20 * 1024 ** 3 },
  };
}

test("minimal latency report separates individual samples and min/median/max", () => {
  assert.deepEqual(summary([5, 1, 3, 2, 4]), {
    minimumMs: 1,
    medianMs: 3,
    maximumMs: 5,
  });
  assert.equal(summary([]).medianMs, null);
});

test("minimal observer refuses unsafe startup without creating a workload", () => {
  const child = new EventEmitter();
  child.kill = () => assert.fail("No process was started");
  assert.throws(
    () =>
      watch(child, sample(1, 511 * 1024 ** 2), () => {}, 100, undefined, {
        ...policy,
        minimumStartAvailableMemoryBytes: 512 * 1024 ** 2,
      }),
    /memory/,
  );
});

test("minimal observer interrupts only its operation when emergency RAM is crossed", async () => {
  const child = new EventEmitter();
  let killed = 0;
  child.kill = () => {
    killed += 1;
  };
  await assert.rejects(
    watch(
      child,
      sample(1),
      async () => sample(2, 500 * 1024 ** 2),
      100,
      undefined,
      {
        ...policy,
        minimumAvailableMemoryBytes: 512 * 1024 ** 2,
      },
    ),
    /memory/,
  );
  assert.equal(killed, 1);
});

test("minimal observer retains sustained CPU protection", async () => {
  const child = new EventEmitter();
  child.kill = () => {};
  const current = sample(17);
  current.clock.idle = 80;
  await assert.rejects(
    watch(child, sample(1), async () => current, 100, undefined, policy),
    /CPU/,
  );
});

test("authorized zero memory floor still measures available RAM", async () => {
  const child = new EventEmitter();
  child.kill = () =>
    assert.fail("A zero floor must not stop a finite operation");
  const pending = watch(
    child,
    sample(1, 1),
    async () => sample(2, 1),
    100,
    undefined,
    {
      ...policy,
      minimumStartAvailableMemoryBytes: 0,
      minimumAvailableMemoryBytes: 0,
    },
  );
  child.emit("exit", 0);
  assert.equal((await pending).minHostFreeBytes, 1);
});

test("minimal live collector has no subprocesses or SQL in its sampling implementation", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(
    path.join(__dirname, "../load/minimal.js"),
    "utf8",
  );
  assert.ok(collector);
  assert.doesNotMatch(source, /execFile|spawn\(|queryRaw|executeRaw/);
});

test("idempotency rejects a replay whose unprojected fields differ from creation", async () => {
  const { planFixture } = require("../load/fixture-manager");
  const scripts = require("../load/write-scenarios");
  const manifest = planFixture("idempotency", 2, true);
  const customer = manifest.customers[0];
  const body = {
    id: "one-order",
    status: "PENDING_PAYMENT",
    currency: "BRL",
    totalInCents: 1000,
    address: { sourceAddressId: customer.addressId },
    updatedAt: "original",
    sellerOrders: [
      {
        sellerId: manifest.seller.id,
        items: [
          {
            productId: customer.productId,
            quantity: 1,
            lineTotalInCents: 1000,
          },
        ],
      },
    ],
  };
  let calls = 0;
  await assert.rejects(
    scripts.run({
      manifest,
      operations: 2,
      concurrency: 2,
      mode: "simulation",
      destination: "simulation",
      transport: async () => {
        calls += 1;
        return {
          status: calls === 1 ? 201 : 200,
          body: { ...body, updatedAt: calls === 1 ? "original" : "changed" },
          headers: { "Idempotency-Replayed": "true" },
        };
      },
      inspect: () =>
        assert.fail("Replay mismatch must fail before persisted inspection"),
    }),
    /Idempotent replay result differs/,
  );
});
