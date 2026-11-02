const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const { spawnSync } = require("node:child_process");
const express = require("express");
const jwt = require("jsonwebtoken");
const { Prisma } = require("@prisma/client");

// Explicit opt-in only inside this isolated test process. No database collector starts on import.
process.env.METRICS_ENABLED = "true";
const {
  createMetrics,
  metrics,
  metricsHandler,
} = require("../dist/observability/metrics");
const {
  createPostgresCollector,
  readPostgresSnapshot,
} = require("../dist/observability/postgresMetrics");
const { requestLogging } = require("../dist/middlewares/requestLogging");
const { createLogger, logger } = require("../dist/utils/logger");
const { checkoutRoutes } = require("../dist/controllers/checkoutController");
const {
  checkoutRepository,
  CheckoutConflictError,
} = require("../dist/repositories/checkoutRepository");
const { userRepository } = require("../dist/repositories/userRepository");
const {
  customerRepository,
} = require("../dist/repositories/customerRepository");
const quiet = createLogger({ sink() {} });
const servers = [];

async function listen(app) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  servers.push(server);
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function metricValue(measurements, name, labels = {}, metricName = name) {
  const metric = await measurements.registry.getSingleMetric(name).get();
  return metric.values.find(
    (item) =>
      (item.metricName ?? name) === metricName &&
      Object.entries(labels).every(
        ([key, value]) => item.labels[key] === value,
      ),
  )?.value;
}

function deferred() {
  let resolve;
  const promise = new Promise((release) => {
    resolve = release;
  });
  return { promise, resolve };
}

test.after(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("HTTP completion records one response, duration and a balanced in-flight gauge", async () => {
  const measured = createMetrics(true, false);
  const entered = deferred();
  const release = deferred();
  const app = express();
  app.use(requestLogging(quiet, measured));
  app.get("/products/:productId", async (_req, res) => {
    entered.resolve();
    await release.promise;
    res.sendStatus(201);
  });
  const { url } = await listen(app);
  const responsePending = fetch(
    `${url}/products/private-product?email=private-email`,
  );
  await entered.promise;
  assert.equal(
    await metricValue(measured, "marketplace_http_requests_in_flight"),
    1,
  );
  release.resolve();
  const response = await responsePending;
  assert.equal(response.status, 201);
  await response.text();
  await new Promise(setImmediate);
  const labels = {
    method: "GET",
    route: "/products/:productId",
    status: "201",
  };
  assert.equal(
    await metricValue(measured, "marketplace_http_requests_total", labels),
    1,
  );
  assert.equal(
    await metricValue(measured, "marketplace_http_requests_in_flight"),
    0,
  );
  assert.equal(
    await metricValue(
      measured,
      "marketplace_http_request_duration_seconds",
      labels,
      "marketplace_http_request_duration_seconds_count",
    ),
    1,
  );
  assert.ok(
    (await metricValue(
      measured,
      "marketplace_http_request_duration_seconds",
      labels,
      "marketplace_http_request_duration_seconds_sum",
    )) >= 0,
  );
  assert.doesNotMatch(
    await measured.registry.metrics(),
    /private-product|private-email|requestId|userId/,
  );
});

test("connection close is counted once and never as a finished response", async () => {
  const measured = createMetrics(true, false);
  const closed = deferred();
  const capture = createLogger({
    sink(line) {
      if (JSON.parse(line).context.outcome === "connection_closed") {
        closed.resolve();
      }
    },
  });
  const app = express();
  app.use(requestLogging(capture, measured));
  app.get("/abort/:id", (_req, res) => {
    res.status(202).flushHeaders();
    res.write("partial");
  });
  const { url } = await listen(app);
  await new Promise((resolve, reject) => {
    const request = http.get(`${url}/abort/private-id`);
    request.once("error", reject);
    request.once("response", (response) => {
      response.once("data", () => {
        response.destroy();
        resolve();
      });
    });
  });
  await closed.promise;
  assert.equal(
    await metricValue(measured, "marketplace_http_connections_closed_total", {
      method: "GET",
      route: "/abort/:id",
    }),
    1,
  );
  assert.equal(
    await metricValue(measured, "marketplace_http_requests_in_flight"),
    0,
  );
  assert.equal(
    await metricValue(measured, "marketplace_http_requests_total", {
      route: "/abort/:id",
    }),
    undefined,
  );
  assert.equal(
    await metricValue(
      measured,
      "marketplace_http_request_duration_seconds",
      { route: "/abort/:id" },
      "marketplace_http_request_duration_seconds_count",
    ),
    undefined,
  );
});

test("HTTP metric completion closure is idempotent and handles disconnect before headers", async () => {
  const measured = createMetrics(true, false);
  const end = measured.startHttp();
  const result = {
    method: "GET",
    route: "/orders/:id",
    status: null,
    seconds: 0.01,
    outcome: "connection_closed",
  };
  end(result);
  end(result);
  assert.equal(
    await metricValue(measured, "marketplace_http_requests_in_flight"),
    0,
  );
  assert.equal(
    await metricValue(measured, "marketplace_http_connections_closed_total", {
      method: "GET",
      route: "/orders/:id",
    }),
    1,
  );
});

test("labels stay bounded across concrete IDs, unknown paths and query strings", async () => {
  const measured = createMetrics(true, false);
  const app = express();
  app.use(requestLogging(quiet, measured));
  app.get("/products/:id", (_req, res) => res.sendStatus(200));
  const { url } = await listen(app);
  for (const path of [
    "/products/private-one?token=private-token",
    "/products/private-two",
    "/unknown-private-one",
    "/unknown-private-two",
  ]) {
    const response = await fetch(`${url}${path}`);
    await response.text();
  }
  const data = await measured.registry
    .getSingleMetric("marketplace_http_requests_total")
    .get();
  assert.equal(data.values.length, 2);
  assert.deepEqual(data.values.map((entry) => entry.labels.route).sort(), [
    "/products/:id",
    "[unmatched]",
  ]);
  assert.ok(data.values.every((entry) => entry.value === 2));
  assert.doesNotMatch(
    await measured.registry.metrics(),
    /private-|requestId|userId|fingerprint/,
  );
});

test("endpoint is opt-in, private and excludes repeated scrapes from HTTP metrics", async () => {
  for (const enabled of [false, true]) {
    const measured = createMetrics(enabled, false);
    const app = express();
    app.use(requestLogging(quiet, measured));
    app.get("/metrics", metricsHandler(measured));
    app.get("/", (_req, res) => res.sendStatus(200));
    const { url } = await listen(app);
    await (await fetch(url)).text();
    for (const path of ["/metrics", "/METRICS/?anything=private-secret"]) {
      const response = await fetch(`${url}${path}`);
      assert.equal(response.status, enabled ? 200 : 404);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = await response.text();
      if (enabled) {
        assert.match(response.headers.get("content-type"), /text\/plain/);
        assert.match(body, /marketplace_http_requests_total/);
        assert.doesNotMatch(body, /private-secret|requestId/);
      }
    }
    if (enabled) {
      const values = await measured.registry
        .getSingleMetric("marketplace_http_requests_total")
        .get();
      assert.equal(values.values.length, 1);
      assert.equal(values.values[0].value, 1);
      assert.equal(values.values[0].labels.route, "/");
    } else {
      assert.equal((await measured.registry.getMetricsAsJSON()).length, 0);
    }
  }
});

test("endpoint refuses a non-loopback socket and exposes no error on registry failure", async (t) => {
  const measured = createMetrics(true, false);
  const makeResponse = () => ({
    setHeader() {},
    sendStatus(status) {
      this.status = status;
    },
  });
  const remote = makeResponse();
  await metricsHandler(measured)(
    { socket: { remoteAddress: "192.0.2.1" }, header: () => undefined },
    remote,
  );
  assert.equal(remote.status, 403);
  t.mock.method(measured.registry, "metrics", async () => {
    throw new Error("private-db-url");
  });
  const unavailable = makeResponse();
  await metricsHandler(measured)(
    { socket: { remoteAddress: "127.0.0.1" }, header: () => undefined },
    unavailable,
  );
  assert.equal(unavailable.status, 503);
});

test("actual app has no metrics route by default and enables it only explicitly", () => {
  for (const enabled of ["false", "true"]) {
    const child = spawnSync(
      process.execPath,
      [
        "-e",
        `
      const assert = require('node:assert/strict');
      const { app } = require('./dist/server');
      const enabled = app._router.stack.some(layer => layer.route?.path === '/metrics');
      assert.equal(enabled, process.env.METRICS_ENABLED === 'true');
    `,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, METRICS_ENABLED: enabled },
        encoding: "utf8",
        timeout: 10000,
        windowsHide: true,
      },
    );
    assert.equal(child.status, 0, child.stderr);
  }
});

test("default Node metrics expose CPU and memory without environment labels", async () => {
  const body = await metrics.registry.metrics();
  assert.match(body, /marketplace_process_cpu_seconds_total/);
  assert.match(body, /marketplace_process_resident_memory_bytes/);
  assert.doesNotMatch(
    body,
    /DATABASE_URL|JWT_SECRET|Authorization|postgresql:\/\//,
  );
});

test("checkout metrics use the same classifications as logs without counting replay as creation", async (t) => {
  const logs = [];
  const capture = createLogger({ sink: (line) => logs.push(JSON.parse(line)) });
  for (const level of ["info", "warn", "error"]) {
    t.mock.method(logger, level, capture[level]);
  }
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "metrics-test-only";
  t.after(() => {
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  });
  const user = { id: "private-user", role: "CUSTOMER", isActive: true };
  t.mock.method(userRepository, "findIdentity", async () => user);
  t.mock.method(userRepository, "findById", async () => user);
  t.mock.method(customerRepository, "findByUserId", async () => ({
    id: "private-customer",
  }));
  const app = express();
  app.use(requestLogging());
  app.use(express.json());
  app.use("/checkout", checkoutRoutes);
  const { url } = await listen(app);
  const createdBefore = await metricValue(
    metrics,
    "marketplace_checkout_created_total",
  );
  const replayBefore = await metricValue(
    metrics,
    "marketplace_checkout_replayed_total",
  );
  const technical = new Prisma.PrismaClientInitializationError(
    "private-connection-secret",
    "test",
    "P1001",
  );
  for (const scenario of [
    { replayed: false, status: 201, event: "checkout.created" },
    { replayed: true, status: 200, event: "checkout.replayed" },
    {
      error: new CheckoutConflictError(
        "Existing public message",
        "INSUFFICIENT_STOCK",
      ),
      status: 409,
      event: "checkout.conflict",
      code: "INSUFFICIENT_STOCK",
    },
    {
      error: technical,
      status: 500,
      event: "checkout.failed",
      code: "DATABASE_UNAVAILABLE",
    },
    {
      error: new Error("private-unknown-secret"),
      status: 500,
      event: "checkout.failed",
      code: "UNEXPECTED_CHECKOUT_ERROR",
    },
  ]) {
    t.mock.method(checkoutRepository, "createIdempotentCheckout", async () => {
      if (scenario.error) {
        throw scenario.error;
      }
      return { result: { id: "private-order" }, replayed: scenario.replayed };
    });
    const response = await fetch(`${url}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "private-key",
        Authorization: `Bearer ${jwt.sign({ sub: user.id }, process.env.JWT_SECRET)}`,
      },
      body: JSON.stringify({ addressId: "private-address" }),
    });
    assert.equal(response.status, scenario.status);
    await response.json();
    const event = logs.find(
      (item) =>
        item.event === scenario.event &&
        item.context.requestId === response.headers.get("x-request-id"),
    );
    assert.equal(event.context.code, scenario.code);
  }
  assert.equal(
    await metricValue(metrics, "marketplace_checkout_created_total"),
    createdBefore + 1,
  );
  assert.equal(
    await metricValue(metrics, "marketplace_checkout_replayed_total"),
    replayBefore + 1,
  );
  assert.equal(
    await metricValue(metrics, "marketplace_checkout_conflicts_total", {
      code: "INSUFFICIENT_STOCK",
    }),
    1,
  );
  for (const code of ["DATABASE_UNAVAILABLE", "UNEXPECTED_CHECKOUT_ERROR"]) {
    assert.equal(
      await metricValue(metrics, "marketplace_checkout_failures_total", {
        code,
      }),
      1,
    );
  }
  assert.doesNotMatch(
    await metrics.registry.metrics(),
    /private-|requestId|fingerprint/,
  );
  t.mock.method(
    metrics.registry.getSingleMetric("marketplace_checkout_created_total"),
    "inc",
    () => {
      throw new Error("private-metric-failure");
    },
  );
  t.mock.method(checkoutRepository, "createIdempotentCheckout", async () => ({
    result: { id: "private-order" },
    replayed: false,
  }));
  const successfulDespiteMetricFailure = await fetch(`${url}/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "private-key",
      Authorization: `Bearer ${jwt.sign({ sub: user.id }, process.env.JWT_SECRET)}`,
    },
    body: JSON.stringify({ addressId: "private-address" }),
  });
  assert.equal(successfulDespiteMetricFailure.status, 201);
  assert.deepEqual(await successfulDespiteMetricFailure.json(), {
    id: "private-order",
  });
});

test("unknown checkout codes are ignored and instrumentation failures do not escape", async (t) => {
  const measured = createMetrics(true, false);
  measured.checkoutConflict("private-code");
  measured.checkoutFailed("private-code");
  t.mock.method(
    measured.registry.getSingleMetric("marketplace_checkout_created_total"),
    "inc",
    () => {
      throw new Error("private-error");
    },
  );
  assert.doesNotThrow(() => measured.checkoutCreated());
  const end = measured.startHttp();
  t.mock.method(
    measured.registry.getSingleMetric("marketplace_http_requests_total"),
    "inc",
    () => {
      throw new Error("private-error");
    },
  );
  assert.doesNotThrow(() =>
    end({
      method: "GET",
      route: "/",
      status: 200,
      seconds: 0.01,
      outcome: "finished",
    }),
  );
  assert.equal(
    await metricValue(measured, "marketplace_http_requests_in_flight"),
    0,
  );
  assert.doesNotMatch(await measured.registry.metrics(), /private-/);
});

test("Prisma query observation counts durations in seconds without query labels", async () => {
  const measured = createMetrics(true, false);
  for (const value of [5, 15, NaN, -1]) {
    measured.query(value);
  }
  assert.equal(
    await metricValue(measured, "marketplace_prisma_queries_total"),
    2,
  );
  assert.equal(
    await metricValue(
      measured,
      "marketplace_prisma_query_duration_seconds",
      {},
      "marketplace_prisma_query_duration_seconds_count",
    ),
    2,
  );
  assert.equal(
    await metricValue(
      measured,
      "marketplace_prisma_query_duration_seconds",
      {},
      "marketplace_prisma_query_duration_seconds_sum",
    ),
    0.02,
  );
  const query = await measured.registry
    .getSingleMetric("marketplace_prisma_queries_total")
    .get();
  assert.deepEqual(query.values[0].labels, {});
});

test("database collector serializes periodic samples and stops after in-flight work", async () => {
  const measured = createMetrics(true, false);
  const starts = [deferred(), deferred()];
  const releases = [deferred(), deferred()];
  let calls = 0;
  let active = 0;
  let peak = 0;
  const collector = createPostgresCollector(
    async () => {
      const index = calls++;
      active += 1;
      peak = Math.max(peak, active);
      starts[index].resolve();
      await releases[index].promise;
      active -= 1;
      return { connections: 2, active: 1 };
    },
    measured,
    10,
  );
  collector.start();
  collector.start();
  await starts[0].promise;
  const concurrent = collector.sample();
  assert.equal(calls, 1);
  releases[0].resolve();
  await concurrent;
  await starts[1].promise;
  const stopping = collector.stop();
  releases[1].resolve();
  await stopping;
  await collector.sample();
  assert.equal(calls, 2);
  assert.equal(peak, 1);
  assert.equal(
    await metricValue(measured, "marketplace_postgres_collection_up"),
    1,
  );
});

test("database failure marks samples unavailable instead of zero and allows recovery", async () => {
  const measured = createMetrics(true, false);
  let fail = false;
  const collector = createPostgresCollector(async () => {
    if (fail) {
      throw new Error("postgresql://private-error");
    }
    return { connections: 2, active: 1 };
  }, measured);
  assert.ok(
    Number.isNaN(
      await metricValue(measured, "marketplace_postgres_connections"),
    ),
  );
  collector.start();
  await collector.sample();
  const lastSuccess = await metricValue(
    measured,
    "marketplace_postgres_last_success_timestamp_seconds",
  );
  fail = true;
  await collector.sample();
  assert.equal(
    await metricValue(measured, "marketplace_postgres_collection_up"),
    0,
  );
  assert.ok(
    Number.isNaN(
      await metricValue(measured, "marketplace_postgres_connections"),
    ),
  );
  assert.ok(
    Number.isNaN(
      await metricValue(measured, "marketplace_postgres_active_sessions"),
    ),
  );
  assert.equal(
    await metricValue(measured, "marketplace_postgres_collection_errors_total"),
    1,
  );
  assert.equal(
    await metricValue(
      measured,
      "marketplace_postgres_last_success_timestamp_seconds",
    ),
    lastSuccess,
  );
  fail = false;
  await collector.sample();
  await collector.stop();
  assert.equal(
    await metricValue(measured, "marketplace_postgres_collection_up"),
    1,
  );
  assert.equal(
    await metricValue(measured, "marketplace_postgres_connections"),
    2,
  );
  assert.doesNotMatch(
    await measured.registry.metrics(),
    /private-error|postgresql/,
  );
});

test("disabled metrics never query the database", async () => {
  const measured = createMetrics(false);
  const collector = createPostgresCollector(
    async () => assert.fail("No monitoring SQL when disabled"),
    measured,
  );
  collector.start();
  await collector.sample();
  await collector.stop();
  assert.equal((await measured.registry.getMetricsAsJSON()).length, 0);
});

test("database snapshot uses a read-only bounded transaction with aggregate SQL", async () => {
  const calls = [];
  const fake = {
    $transaction: async (callback, options) => {
      assert.deepEqual(options, { maxWait: 1000, timeout: 1500 });
      return callback({
        $executeRaw: async (sql) => {
          calls.push(sql.join(""));
        },
        $queryRaw: async (sql, ...parameters) => {
          calls.push(sql.join(""));
          if (calls.length === 2) {
            assert.deepEqual(parameters, ["1000"]);
            return [];
          }
          return [{ connections: 3, active: 1 }];
        },
      });
    },
  };
  assert.deepEqual(await readPostgresSnapshot(fake, 1000), {
    connections: 3,
    active: 1,
  });
  assert.match(calls[0], /READ ONLY/);
  assert.match(calls[1], /statement_timeout/);
  assert.match(calls[2], /pg_stat_activity/);
  assert.match(calls[2], /pid <> pg_backend_pid\(\)/);
  assert.equal(calls.length, 3);
});
