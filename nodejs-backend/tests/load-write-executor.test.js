const test = require("node:test");
const assert = require("node:assert/strict");
const { planFixture } = require("../load/fixture-manager");
const target = require("../load/fixture-db");
const { limitsFor, transportFor, quantile } = require("../load/write-executor");

test("scale fixtures require their own confirmation before constructing a client", async () => {
  assert.throws(() => target.client({ mode: "scale" }), /confirmation/);
  assert.throws(() => target.client({ mode: "production" }), /Unknown/);
  assert.throws(
    () => target.client({ mode: "scale", confirmation: "marketplace_scale" }),
    /confirmation/,
  );
  const db = target.client({
    mode: "scale",
    confirmation: target.SCALE_CONFIRMATION,
  });
  try {
    assert.equal(target.descriptor(db).apiUrl, "http://127.0.0.1:8051");
    assert.equal(target.descriptor(db).lockKey, 49314301);
    assert.throws(() => target.assertWrite(db), /administratively disabled/);
    assert.match(
      target.apiEnvironment(db).DATABASE_URL,
      /127.0.0.1:5435\/marketplace_scale\?/,
    );
  } finally {
    await db.$disconnect();
  }
});

test("scale execution requires the exact namespace/scenario/stage approval and budget", () => {
  const manifest = planFixture("cart", 2);
  assert.throws(() => limitsFor("smoke", manifest, undefined, "scale"));
  const approval = `${manifest.namespace}:cart:smoke`;
  assert.throws(
    () => limitsFor("smoke", manifest, approval, "scale"),
    /disabled/,
  );
  const plan = require("../load/plan.json");
  const original = plan.fixtures.writesEnabled;
  try {
    plan.fixtures.writesEnabled = true; // In-memory unit configuration; never saved or connected.
    assert.equal(limitsFor("smoke", manifest, approval, "scale").operations, 2);
    assert.throws(() => limitsFor("low", manifest, approval, "scale"));
    assert.throws(() =>
      limitsFor(
        "smoke",
        manifest,
        approval.replace("cart", "payment"),
        "scale",
      ),
    );
  } finally {
    plan.fixtures.writesEnabled = original;
  }
});

test("HTTP transport sends real JSON, explicit cookies and the same idempotency key", async () => {
  const manifest = planFixture("idempotency", 2);
  const customer = manifest.customers[0];
  let observed;
  const client = transportFor(
    manifest,
    "http://127.0.0.1:8052",
    new Map([[customer.userId, "token=test-only"]]),
    new AbortController().signal,
    async (url, request) => {
      observed = { url, request };
      return new Response(JSON.stringify({ id: "persisted-order" }), {
        status: 201,
        headers: { "Idempotency-Replayed": "false" },
      });
    },
  );
  const response = await client.transport({
    userId: customer.userId,
    method: "POST",
    path: "/checkout",
    body: { addressId: customer.addressId },
    headers: { "Idempotency-Key": customer.key },
  });
  assert.equal(response.status, 201);
  assert.equal(observed.request.headers.Cookie, "token=test-only");
  assert.equal(observed.request.headers["Idempotency-Key"], customer.key);
  assert.deepEqual(JSON.parse(observed.request.body), {
    addressId: customer.addressId,
  });
  assert.equal(observed.url, "http://127.0.0.1:8052/checkout");
  assert.equal(client.aggregate().responses, 1);
  assert.ok(!JSON.stringify(client.aggregate()).includes("test-only"));
  await assert.rejects(
    client.transport({
      userId: customer.userId,
      method: "POST",
      path: "/orders",
    }),
    /allowlist/,
  );
});

test("a lost response blocks another dispatch without retrying or changing the key", async () => {
  const manifest = planFixture("idempotency", 2);
  const customer = manifest.customers[0];
  const cause = new Error("response lost");
  let calls = 0;
  const client = transportFor(
    manifest,
    "http://127.0.0.1:8052",
    new Map([[customer.userId, "token=test-only"]]),
    new AbortController().signal,
    async () => {
      calls += 1;
      throw cause;
    },
  );
  const request = {
    userId: customer.userId,
    method: "POST",
    path: "/checkout",
    body: { addressId: customer.addressId },
    headers: { "Idempotency-Key": customer.key },
  };
  await assert.rejects(client.transport(request), (error) => error === cause);
  await assert.rejects(client.transport(request), /dispatch stopped/);
  assert.equal(calls, 1);
  assert.equal(client.aggregate().unknown, 1);
  assert.equal(request.headers["Idempotency-Key"], customer.key);
});

test("latency percentiles are null for no responses and deterministic for bounded samples", () => {
  assert.equal(quantile([], 0.95), null);
  assert.equal(quantile([10, 20, 30], 0.5), 20);
  assert.equal(quantile([10, 20, 30], 0.95), 29);
});
