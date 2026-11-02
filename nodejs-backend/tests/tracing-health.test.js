const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const express = require("express");
const { Prisma } = require("@prisma/client");
const { trace } = require("@opentelemetry/api");
let exporter;
let server;
let url;
let tracing;
let health;
let records = [];
let payloads = [];
let exporterFails = false;
let db;

function spans() {
  return payloads
    .flatMap((payload) => payload.resourceSpans ?? [])
    .flatMap((resource) => resource.scopeSpans ?? [])
    .flatMap((scope) => scope.spans ?? []);
}
async function flush() {
  await trace.getTracerProvider().getDelegate().forceFlush();
}
async function start(app) {
  const instance = app.listen(0, "127.0.0.1");
  await once(instance, "listening");
  return instance;
}
async function stop(instance) {
  instance.closeAllConnections();
  await new Promise((resolve) => instance.close(resolve));
}
test.before(async () => {
  exporter = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }
    payloads.push(JSON.parse(body));
    res.writeHead(exporterFails ? 400 : 200, {
      "Content-Type": "application/json",
    });
    res.end("{}");
  });
  exporter.listen(0, "127.0.0.1");
  await once(exporter, "listening");
  process.env.TRACING_ENABLED = "true";
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = `http://127.0.0.1:${exporter.address().port}/v1/traces`;
  tracing = require("../dist/observability/tracing");
  health = require("../dist/observability/health");
  const { createLogger } = require("../dist/utils/logger");
  const { requestLogging } = require("../dist/middlewares/requestLogging");
  const { ProductService } = require("../dist/services/productService");
  const {
    ProductRepository,
  } = require("../dist/repositories/productRepository");
  db = require("../dist/config/db").default;
  // Actual repository and Prisma entrypoints, replaced only at the IO boundary.
  db.product.count = async () => 1;
  db.product.findMany = async () => [
    {
      id: "private-product",
      sellerId: "private-seller",
      name: "Fixture",
      reference: null,
      description: null,
      image: null,
      priceInCents: 100,
      currency: "BRL",
      category: "ELECTRONICS",
      seller: { storeName: "Fixture" },
      inventory: { onHandQuantity: 1, reservedQuantity: 0 },
    },
  ];
  db.review.groupBy = async () => [];
  const service = new ProductService(new ProductRepository());
  const app = express();
  app.use(tracing.catalogTracing);
  app.use(
    requestLogging(
      createLogger({ sink: (line) => records.push(JSON.parse(line)) }),
    ),
  );
  app.get("/products", async (_req, res) => {
    try {
      await Promise.resolve();
      const result = await service.listProducts();
      res.json(result);
    } catch {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  app.get("/health/live", health.liveness);
  app.get("/metrics", (_req, res) => res.send("test"));
  server = await start(app);
  url = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  await stop(server);
  await tracing.stopTracing();
  if (exporter.listening) {
    await stop(exporter);
  }
  await db.$disconnect();
});

test("concurrent collection requests have isolated real operation trees and correlated logs", async () => {
  records = [];
  payloads = [];
  const responses = await Promise.all([
    fetch(`${url}/products?search=private-query`, {
      headers: {
        Cookie: "token=private-cookie",
        Authorization: "Bearer private-token",
        "Idempotency-Key": "private-idempotency",
      },
    }),
    fetch(`${url}/products`),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200],
  );
  await flush();
  const all = spans();
  const roots = all.filter((span) => span.name === "GET /products/");
  assert.equal(roots.length, 2);
  assert.notEqual(roots[0].traceId, roots[1].traceId);
  for (const root of roots) {
    const tree = all.filter((span) => span.traceId === root.traceId);
    assert.equal(tree.length, 8);
    const service = tree.find((span) => span.name === "catalog.list");
    assert.equal(service.parentSpanId, root.spanId);
    for (const operation of [
      "product.count",
      "product.findMany",
      "review.groupBy",
    ]) {
      const query = tree.find((span) => span.name === `prisma.${operation}`);
      assert.ok(query);
      const parent = tree.find((span) => span.spanId === query.parentSpanId);
      assert.match(parent.name, /^repository\./);
      assert.equal(parent.parentSpanId, service.spanId);
    }
    const log = records.find(
      (record) => record.context.traceId === root.traceId,
    );
    assert.equal(log.context.spanId, root.spanId);
    assert.ok(
      responses.some(
        (response) =>
          response.headers.get("x-request-id") === log.context.requestId,
      ),
    );
  }
  const serialized = JSON.stringify({ payloads, records });
  for (const secret of [
    "private-query",
    "private-cookie",
    "private-token",
    "private-idempotency",
    "private-product",
    "private-seller",
    "db.statement",
    "url.full",
  ]) {
    assert.ok(!serialized.includes(secret));
  }
});

test("metrics and health are not traced", async () => {
  payloads = [];
  await fetch(`${url}/health/live`);
  await fetch(`${url}/metrics`);
  await flush();
  assert.equal(spans().length, 0);
});

test("unknown errors are sanitized, typed database errors classified and original rethrown", async () => {
  for (const [error, code] of [
    [new Error("password=private-secret SQL SELECT"), "OPERATION_FAILED"],
    [
      new Prisma.PrismaClientKnownRequestError("private", {
        code: "P1001",
        clientVersion: "6.11.1",
      }),
      "DATABASE_UNAVAILABLE",
    ],
    [
      new Prisma.PrismaClientKnownRequestError("private", {
        code: "P2024",
        clientVersion: "6.11.1",
      }),
      "DATABASE_TIMEOUT",
    ],
    [{ code: "P1001", message: "private" }, "OPERATION_FAILED"],
  ]) {
    payloads = [];
    const original = db.product.count;
    db.product.count = async () => {
      throw error;
    };
    const response = await fetch(`${url}/products`);
    db.product.count = original;
    assert.equal(response.status, 500);
    await flush();
    assert.ok(
      spans().some((span) =>
        span.attributes.some(
          (attribute) =>
            attribute.key === "error.type" &&
            attribute.value.stringValue === code,
        ),
      ),
    );
    assert.ok(!JSON.stringify(payloads).includes("private"));
    assert.equal(tracing.traceFailure(error), code);
    const marker = tracing.catalogTracer.startSpan("test.safe");
    const { context } = require("@opentelemetry/api");
    await context.with(trace.setSpan(context.active(), marker), async () => {
      await assert.rejects(
        tracing.catalogSpan("test.failure", async () => {
          throw error;
        }),
        (caught) => caught === error,
      );
    });
    marker.end();
  }
});

test("exporter rejecting spans does not change catalogue responses", async () => {
  exporterFails = true;
  try {
    assert.equal((await fetch(`${url}/products`)).status, 200);
    await flush().catch(() => undefined);
    assert.equal((await fetch(`${url}/products`)).status, 200);
  } finally {
    exporterFails = false;
  }
});

test("liveness does not consult PostgreSQL", async () => {
  const response = await fetch(`${url}/health/live`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "live" });
});

test("readiness reuses concurrent probes, caches briefly and returns safe status", async () => {
  let calls = 0;
  let release;
  const app = express();
  app.get(
    "/",
    health.readiness(async () => {
      calls++;
      await new Promise((resolve) => {
        release = resolve;
      });
    }),
  );
  const instance = await start(app);
  try {
    const address = `http://127.0.0.1:${instance.address().port}`;
    const first = fetch(address);
    const second = fetch(address);
    while (!release) {
      await new Promise(setImmediate);
    }
    release();
    assert.deepEqual(
      (await Promise.all([first, second])).map((response) => response.status),
      [200, 200],
    );
    assert.equal((await fetch(address)).status, 200);
    assert.equal(calls, 1);
  } finally {
    await stop(instance);
  }
});

test("readiness timeout stays single-flight even after HTTP deadline", async () => {
  let calls = 0;
  let release;
  const app = express();
  app.get(
    "/",
    health.readiness(
      async () => {
        calls++;
        await new Promise((resolve) => {
          release = resolve;
        });
      },
      25,
      0,
    ),
  );
  const instance = await start(app);
  try {
    const address = `http://127.0.0.1:${instance.address().port}`;
    const response = await fetch(address);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "unavailable" });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await fetch(address)).status, 503);
    assert.equal(calls, 1);
    release();
  } finally {
    await stop(instance);
  }
});

test("readiness failure never exposes database details", async () => {
  const app = express();
  app.get(
    "/",
    health.readiness(async () => {
      throw new Error("postgresql://private-password");
    }),
  );
  const instance = await start(app);
  try {
    const response = await fetch(`http://127.0.0.1:${instance.address().port}`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "unavailable" });
  } finally {
    await stop(instance);
  }
});

test("database probe uses read only transaction, statement timeout and pool deadline", async () => {
  const statements = [];
  const tx = {
    $executeRaw: async (parts, ...values) =>
      statements.push([parts.join("?"), values]),
    $queryRaw: async (parts, ...values) =>
      statements.push([parts.join("?"), values]),
  };
  await health.checkDatabase(
    {
      $transaction: async (callback, options) => {
        assert.deepEqual(options, { maxWait: 100, timeout: 350 });
        await callback(tx);
      },
    },
    100,
  );
  assert.match(statements[0][0], /READ ONLY/);
  assert.match(statements[1][0], /statement_timeout/);
  assert.deepEqual(statements[1][1], ["100"]);
  assert.match(statements[2][0], /SELECT 1/);
});

test("private metrics requires explicit source AND dedicated credential", async () => {
  const {
    metricsHandler,
    createMetrics,
  } = require("../dist/observability/metrics");
  const handler = metricsHandler(createMetrics(true, false), {
    addresses: ["172.30.63.2"],
    token: "a".repeat(64),
  });
  for (const [address, authorization, expected] of [
    ["172.30.63.2", `Bearer ${"a".repeat(64)}`, 200],
    ["172.30.63.2", "", 403],
    ["172.30.63.3", `Bearer ${"a".repeat(64)}`, 403],
    ["172.30.63.2", `Bearer ${"b".repeat(64)}`, 403],
  ]) {
    let status = 200;
    const res = {
      setHeader() {},
      sendStatus(value) {
        status = value;
      },
      type() {
        return this;
      },
      send() {},
    };
    await handler(
      { socket: { remoteAddress: address }, header: () => authorization },
      res,
    );
    assert.equal(status, expected);
  }
});

test("unreachable exporter never prevents the HTTP operation", async () => {
  await flush();
  await stop(exporter);
  assert.equal((await fetch(`${url}/products`)).status, 200);
  await flush().catch(() => undefined);
  const response = await fetch(`${url}/products`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).pagination.total, 1);
});
