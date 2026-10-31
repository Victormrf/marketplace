const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const express = require("express");
const jwt = require("jsonwebtoken");
const { Prisma } = require("@prisma/client");
const { createLogger, logger } = require("../dist/utils/logger");
const { getRequestId } = require("../dist/utils/requestContext");
const { requestLogging } = require("../dist/middlewares/requestLogging");
const { checkoutRoutes } = require("../dist/controllers/checkoutController");
const {
  checkoutRepository,
  CheckoutConflictError,
  CheckoutRepository,
} = require("../dist/repositories/checkoutRepository");
const dbModule = require("../dist/config/db");
const { CHECKOUT_CONFLICT_CODES } = require("../dist/types/checkout");
const { userRepository } = require("../dist/repositories/userRepository");
const {
  customerRepository,
} = require("../dist/repositories/customerRepository");
const { app: productionApp } = require("../dist/server");

const secretBefore = process.env.JWT_SECRET;
const user = {
  id: "logging-test-customer",
  email: "private@local.invalid",
  role: "CUSTOMER",
  isActive: true,
};
const result = { id: "logging-test-order", totalInCents: 1000 };
let records;
let server;
let baseUrl;
let productionServer;
let productionUrl;
let token;
let abortLogged;
let pendingConcurrent;
let earlyStarted;

async function listen(app) {
  const instance = app.listen(0, "127.0.0.1");
  await once(instance, "listening");
  return {
    server: instance,
    url: `http://127.0.0.1:${instance.address().port}`,
  };
}

function forRequest(id) {
  return records.filter((record) => record.context.requestId === id);
}

async function checkout(
  id = randomUUID(),
  input = { addressId: "private-address" },
  authenticated = true,
) {
  return fetch(`${baseUrl}/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": id,
      "Idempotency-Key": "private-idempotency-key",
      ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });
}

test.before(async () => {
  process.env.JWT_SECRET = "logging-tests-only-not-a-real-secret";
  token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET);
  const app = express();
  app.use(requestLogging());
  app.use(express.json());
  app.get("/products/:productId", async (req, res) => {
    await Promise.resolve();
    res.json({ requestId: req.requestId, serviceRequestId: getRequestId() });
  });
  app.get("/concurrent/:id", async (req, res) => {
    const original = getRequestId();
    await new Promise((resolve) => {
      pendingConcurrent.push(resolve);
      if (pendingConcurrent.length === 2) {
        pendingConcurrent.forEach((release) => release());
      }
    });
    logger.info("checkout.created");
    res.json({
      before: original,
      after: getRequestId(),
      direct: req.requestId,
    });
  });
  app.get("/abort/:id", (_req, res) => {
    res.status(202).flushHeaders();
    res.write("partial");
  });
  app.get("/empty", (_req, res) => {
    res.sendStatus(204);
  });
  app.get("/early-abort/:id", () => {
    earlyStarted?.();
  });
  app.get("/status/:status", (req, res) => {
    res.sendStatus(Number(req.params.status));
  });
  app.use("/checkout", checkoutRoutes);
  ({ server, url: baseUrl } = await listen(app));
  ({ server: productionServer, url: productionUrl } =
    await listen(productionApp));
});

test.beforeEach((t) => {
  records = [];
  pendingConcurrent = [];
  abortLogged = undefined;
  earlyStarted = undefined;
  const captured = createLogger({
    level: "debug",
    sink(line) {
      const record = JSON.parse(line);
      records.push(record);
      if (record.context.outcome === "connection_closed") {
        abortLogged?.();
      }
    },
  });
  for (const level of ["debug", "info", "warn", "error"]) {
    t.mock.method(logger, level, captured[level]);
  }
  t.mock.method(userRepository, "findIdentity", async () => ({ ...user }));
  t.mock.method(userRepository, "findById", async () => ({ ...user }));
  t.mock.method(customerRepository, "findByUserId", async () => ({
    id: "private-customer-profile",
  }));
  t.mock.method(checkoutRepository, "createIdempotentCheckout", async () => ({
    result,
    replayed: false,
  }));
});

test.after(async () => {
  for (const instance of [server, productionServer]) {
    instance.closeAllConnections();
    await new Promise((resolve) => instance.close(resolve));
  }
  if (secretBefore === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = secretBefore;
  }
});

test("generates a UUID and exposes it to controller, async service and response", async () => {
  const response = await fetch(
    `${baseUrl}/products/private-product?email=secret`,
  );
  const id = response.headers.get("x-request-id");
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(await response.json(), {
    requestId: id,
    serviceRequestId: id,
  });
  const [record] = forRequest(id);
  assert.equal(record.context.route, "/products/:productId");
  assert.equal(record.context.status, 200);
  assert.equal(record.context.method, "GET");
  assert.ok(Number.isFinite(record.context.durationMs));
  assert.ok(record.context.durationMs >= 0);
  assert.ok(!Number.isNaN(Date.parse(record.timestamp)));
  assert.equal(getRequestId(), undefined);
});

test("preserves a valid supplied UUID and replaces malformed or oversized values", async () => {
  const valid = randomUUID();
  for (const supplied of [
    valid,
    "email@private.invalid",
    "x".repeat(256),
    "",
  ]) {
    const response = await fetch(`${baseUrl}/empty`, {
      headers: { "X-Request-ID": supplied },
    });
    const id = response.headers.get("x-request-id");
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.equal(id === supplied, supplied === valid);
    await response.arrayBuffer();
    assert.equal(forRequest(id).length, 1);
  }
});

test("concurrent requests keep distinct context across awaited work and completion", async () => {
  const ids = [randomUUID(), randomUUID()];
  const responses = await Promise.all(
    ids.map((id) =>
      fetch(`${baseUrl}/concurrent/private-id`, {
        headers: { "X-Request-ID": id },
      }),
    ),
  );
  for (const [index, response] of responses.entries()) {
    const id = ids[index];
    assert.deepEqual(await response.json(), {
      before: id,
      after: id,
      direct: id,
    });
    assert.deepEqual(
      forRequest(id).map((record) => record.event),
      ["checkout.created", "http.completed"],
    );
  }
  assert.equal(getRequestId(), undefined);
});

test("normal completion logs once despite finish followed by close, including 204", async () => {
  const response = await fetch(`${baseUrl}/empty`);
  await response.arrayBuffer();
  await new Promise(setImmediate);
  const entries = forRequest(response.headers.get("x-request-id"));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].context.status, 204);
  assert.equal(entries[0].context.code, undefined);
  assert.equal(entries[0].context.outcome, "finished");
});

test("an aborted connection has one completion with its same request ID", async () => {
  const id = randomUUID();
  const logged = new Promise((resolve) => {
    abortLogged = resolve;
  });
  await new Promise((resolve, reject) => {
    const request = http.get(`${baseUrl}/abort/private-id`, {
      headers: { "X-Request-ID": id },
    });
    request.on("error", reject);
    request.on("response", (response) => {
      assert.equal(response.headers["x-request-id"], id);
      response.once("data", () => {
        response.destroy();
        resolve();
      });
    });
  });
  await logged;
  const entries = forRequest(id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].level, "warn");
  assert.equal(entries[0].context.outcome, "connection_closed");
  assert.equal(entries[0].context.status, 202);
  assert.equal(entries[0].context.code, "HTTP_CONNECTION_CLOSED");
  assert.equal(entries[0].context.route, "/abort/:id");
});

test("connection closed before headers records null status instead of a fictitious 200", async () => {
  const id = randomUUID();
  const started = new Promise((resolve) => {
    earlyStarted = resolve;
  });
  const logged = new Promise((resolve) => {
    abortLogged = resolve;
  });
  const request = http.get(`${baseUrl}/early-abort/private-id`, {
    headers: { "X-Request-ID": id },
  });
  const disconnected = new Promise((resolve) => {
    request.once("error", (error) => {
      assert.equal(error.code, "ECONNRESET");
      resolve();
    });
  });
  await started;
  request.destroy();
  await Promise.all([logged, disconnected]);
  const entries = forRequest(id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].context.status, null);
  assert.equal(entries[0].context.code, "HTTP_CONNECTION_CLOSED");
  assert.equal(entries[0].context.outcome, "connection_closed");
});

test("checkout creation and replay share context with HTTP and preserve contracts", async (t) => {
  for (const replayed of [false, true]) {
    t.mock.method(checkoutRepository, "createIdempotentCheckout", async () => {
      assert.ok(getRequestId());
      return { result, replayed };
    });
    const id = randomUUID();
    const response = await checkout(id);
    assert.equal(response.status, replayed ? 200 : 201);
    assert.equal(
      response.headers.get("idempotency-replayed"),
      replayed ? "true" : null,
    );
    assert.deepEqual(await response.json(), result);
    const entries = forRequest(id);
    assert.deepEqual(
      entries.map((entry) => entry.event),
      [replayed ? "checkout.replayed" : "checkout.created", "http.completed"],
    );
    assert.equal(entries[1].context.route, "/checkout/");
    assert.ok(entries.every((entry) => entry.context.code === undefined));
  }
});

test("expected checkout conflict is warn, preserves 409 and logs no raw message", async (t) => {
  t.mock.method(checkoutRepository, "createIdempotentCheckout", async () => {
    throw new CheckoutConflictError("Cart stock is insufficient");
  });
  const id = randomUUID();
  const response = await checkout(id);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "Cart stock is insufficient",
  });
  const entries = forRequest(id);
  assert.deepEqual(
    entries.map((entry) => entry.event),
    ["checkout.conflict", "http.completed"],
  );
  assert.equal(entries[0].level, "warn");
  assert.equal(entries[0].context.code, "BUSINESS_CONFLICT");
  assert.equal(entries[1].context.code, "HTTP_CONFLICT");
  assert.doesNotMatch(
    JSON.stringify(entries),
    /Cart stock|private-address|private-idempotency-key/,
  );
});

test("unexpected checkout error emits a single safe failure event and a generic 500", async (t) => {
  t.mock.method(checkoutRepository, "createIdempotentCheckout", async () => {
    throw Object.assign(
      new Error("postgresql://secret-user:password@remote/private-db"),
      {
        cause: new Error("token=private-cookie"),
        meta: { email: "private@local.invalid" },
      },
    );
  });
  const id = randomUUID();
  const response = await checkout(id);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { message: "Internal Server Error" });
  const entries = forRequest(id);
  assert.deepEqual(
    entries.map((entry) => entry.event),
    ["checkout.failed", "http.completed"],
  );
  assert.equal(entries[0].context.code, "UNEXPECTED_CHECKOUT_ERROR");
  assert.equal(entries[1].context.code, "HTTP_SERVER_ERROR");
  assert.equal(entries[0].level, "error");
  assert.doesNotMatch(
    JSON.stringify(entries),
    /postgresql|secret-user|password|private-cookie|private@|stack|cause|meta/,
  );
});

test("validation, authorization and not-found responses retain IDs without technical failure events", async (t) => {
  const unauthenticated = await checkout(
    randomUUID(),
    { addressId: "private" },
    false,
  );
  const validation = await checkout(randomUUID(), {});
  t.mock.method(userRepository, "findById", async () => ({
    ...user,
    role: "SELLER",
  }));
  const forbidden = await checkout();
  t.mock.method(userRepository, "findById", async () => null);
  const missing = await checkout();
  for (const [response, status, code] of [
    [unauthenticated, 401, "HTTP_UNAUTHENTICATED"],
    [validation, 400, "HTTP_BAD_REQUEST"],
    [forbidden, 403, "HTTP_FORBIDDEN"],
    [missing, 404, "HTTP_NOT_FOUND"],
  ]) {
    assert.equal(response.status, status);
    await response.json();
    const entries = forRequest(response.headers.get("x-request-id"));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].event, "http.completed");
    assert.equal(entries[0].context.status, status);
    assert.equal(entries[0].context.code, code);
  }
});

test("actual Express app wires request logging before routes and masks unknown URLs", async () => {
  for (const [path, status] of [
    ["/", 200],
    ["/private-email@local.invalid?token=private", 404],
  ]) {
    const response = await fetch(`${productionUrl}${path}`);
    await response.text();
    assert.equal(response.status, status);
    const entries = forRequest(response.headers.get("x-request-id"));
    assert.equal(entries.length, 1);
    assert.equal(
      entries[0].context.route,
      status === 404 ? "[unmatched]" : "/",
    );
    assert.doesNotMatch(
      JSON.stringify(entries),
      /private-email|token|local.invalid/,
    );
  }
});

test("logger filters all four levels and defaults invalid configuration to info", () => {
  for (const [configured, expected] of [
    ["debug", 4],
    ["info", 3],
    ["warn", 2],
    ["error", 1],
    ["invalid", 3],
  ]) {
    const captured = [];
    const log = createLogger({
      level: configured,
      sink: (line) => captured.push(JSON.parse(line)),
    });
    for (const level of ["debug", "info", "warn", "error"]) {
      log[level]("server.started");
    }
    assert.equal(captured.length, expected);
  }
});

test("logger drops sensitive/unknown fields, nested objects, unsafe values and errors", () => {
  const captured = [];
  const log = createLogger({
    level: "debug",
    sink: (line) => captured.push(line),
  });
  const sensitive = {
    password: "secret-password",
    token: "secret-token",
    cookie: "secret-cookie",
    authorization: "Bearer secret-authorization",
    headers: { secret: "secret-header" },
    idempotencyKey: "secret-key",
    fingerprint: "secret-fingerprint",
    address: "secret-address",
    email: "secret-email",
    payment: "secret-payment",
    databaseUrl: "postgresql://secret-db",
    body: { secret: "secret-body" },
    response: { secret: "secret-response" },
    error: new Error("secret-error"),
    stack: "secret-stack",
    cause: "secret-cause",
    requestId: "secret-forged-id",
    code: "secret-code",
    route: "/path?token=secret-query",
    method: "secret-method",
    durationMs: NaN,
  };
  log.error("checkout.failed", sensitive);
  assert.deepEqual(JSON.parse(captured[0]).context, {});
  assert.doesNotMatch(captured[0], /secret-|postgresql|Bearer/);
  log.info("secret-event", sensitive);
  assert.equal(JSON.parse(captured[1]).event, "log.invalid_event");
});

test("an unavailable log sink never changes the business execution", () => {
  const log = createLogger({
    sink() {
      throw new Error("private sink failure");
    },
  });
  assert.doesNotThrow(() => log.info("checkout.created"));
});

test("typed checkout conflict codes reach logs without changing public messages", async (t) => {
  for (const code of CHECKOUT_CONFLICT_CODES) {
    t.mock.method(checkoutRepository, "createIdempotentCheckout", async () => {
      throw new CheckoutConflictError("Existing public conflict message", code);
    });
    const id = randomUUID();
    const response = await checkout(id);
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "Existing public conflict message",
    });
    const entries = forRequest(id);
    assert.deepEqual(
      entries.map((entry) => entry.event),
      ["checkout.conflict", "http.completed"],
    );
    assert.equal(entries[0].context.code, code);
    assert.equal(entries[1].context.code, "HTTP_CONFLICT");
    assert.doesNotMatch(
      JSON.stringify(entries),
      /Existing public|private-address|private-idempotency-key/,
    );
  }
});

test("repository assigns cart conflict codes at detection, preserving error messages", async (t) => {
  const originalDb = dbModule.default;
  t.after(() => {
    dbModule.default = originalDb;
  });
  const product = {
    id: "p",
    sellerId: "s",
    isActive: true,
    currency: "BRL",
    priceInCents: 1000,
  };
  const seller = { id: "s", isActive: true };
  const inventory = {
    id: "i",
    productId: "p",
    onHandQuantity: 1,
    reservedQuantity: 0,
  };
  const cases = [
    { items: [], code: "CART_EMPTY", message: "Cart is empty" },
    {
      products: [],
      code: "PRODUCT_NOT_FOUND",
      message: "Cart contains a missing product",
    },
    {
      sellers: [],
      code: "SELLER_NOT_FOUND",
      message: "Cart contains a missing seller",
    },
    {
      quantity: 0,
      code: "INVALID_QUANTITY",
      message: "Cart quantity is invalid",
    },
    {
      quantity: 1.5,
      code: "INVALID_QUANTITY",
      message: "Cart quantity is invalid",
    },
    {
      products: [{ ...product, isActive: false }],
      code: "PRODUCT_UNAVAILABLE",
      message: "Cart contains an unavailable product",
    },
    {
      sellers: [{ ...seller, isActive: false }],
      code: "PRODUCT_UNAVAILABLE",
      message: "Cart contains an unavailable product",
    },
    {
      inventories: [],
      code: "INVENTORY_UNAVAILABLE",
      message: "Cart contains an unavailable product",
    },
    {
      quantity: 2,
      code: "INSUFFICIENT_STOCK",
      message: "Cart stock is insufficient",
    },
    {
      inventories: [{ ...inventory, reservedQuantity: 1 }],
      code: "INSUFFICIENT_STOCK",
      message: "Cart stock is insufficient",
    },
    {
      products: [{ ...product, currency: "USD" }],
      code: "UNSUPPORTED_CURRENCY",
      message: "Cart stock is insufficient",
    },
  ];
  for (const scenario of cases) {
    const responses = [
      [],
      [{ id: "address" }],
      scenario.products ?? [product],
      scenario.sellers ?? [seller],
      scenario.inventories ?? [inventory],
    ];
    const tx = {
      $queryRaw: async () => {
        assert.ok(responses.length, "No unexpected SQL calls");
        return responses.shift();
      },
      cart: {
        findFirst: async () => ({
          id: "cart",
          items: scenario.items ?? [
            { id: "item", productId: "p", quantity: scenario.quantity ?? 1 },
          ],
        }),
      },
    };
    dbModule.default = { $transaction: async (callback) => callback(tx) };
    await assert.rejects(
      () =>
        new CheckoutRepository().createFromActiveCart("customer", "address"),
      (error) => {
        assert.ok(error instanceof CheckoutConflictError);
        assert.equal(error.code, scenario.code);
        assert.equal(error.message, scenario.message);
        return true;
      },
    );
  }
});

test("repository derives idempotency codes from structured state without message matching", async (t) => {
  const originalDb = dbModule.default;
  t.after(() => {
    dbModule.default = originalDb;
  });
  const cases = [
    {
      row: null,
      code: "IDEMPOTENCY_STATE_CONFLICT",
      message: "Idempotency key was used with a different request",
    },
    {
      row: { requestFingerprint: "different", status: "COMPLETED" },
      code: "IDEMPOTENCY_FINGERPRINT_MISMATCH",
      message: "Idempotency key was used with a different request",
    },
    {
      row: { requestFingerprint: "same", status: "PROCESSING" },
      code: "IDEMPOTENCY_PROCESSING",
      message: "Idempotency key is processing",
    },
    {
      row: { requestFingerprint: "same", status: "FAILED" },
      code: "IDEMPOTENCY_STATE_CONFLICT",
      message: "Idempotency key is failed",
    },
    {
      row: { requestFingerprint: "same", status: "COMPLETED", result: null },
      code: "IDEMPOTENCY_STATE_CONFLICT",
      message: "Idempotency key is completed",
    },
  ];
  for (const scenario of cases) {
    const tx = {
      $queryRaw: async () => [],
      idempotencyKey: { findFirst: async () => scenario.row },
    };
    dbModule.default = { $transaction: async (callback) => callback(tx) };
    await assert.rejects(
      () =>
        new CheckoutRepository().createIdempotentCheckout({
          userId: "u",
          customerId: "c",
          addressId: "a",
          operation: "CHECKOUT_V1",
          key: "private-key",
          requestFingerprint: "same",
          expiresAt: new Date(),
          serialize: () => ({}),
        }),
      (error) => {
        assert.ok(error instanceof CheckoutConflictError);
        assert.equal(error.code, scenario.code);
        assert.equal(error.message, scenario.message);
        return true;
      },
    );
  }
});

test("only recognized Prisma types/codes distinguish database availability and timeout", async (t) => {
  const sensitiveMessage =
    "postgresql://private-user:private-password@remote/private-db token=private-token";
  const known = (code) =>
    new Prisma.PrismaClientKnownRequestError(sensitiveMessage, {
      code,
      clientVersion: "test",
      meta: { secret: "private-meta" },
    });
  const init = (code) =>
    new Prisma.PrismaClientInitializationError(sensitiveMessage, "test", code);
  const cases = [
    [known("P1001"), "DATABASE_UNAVAILABLE"],
    [init("P1001"), "DATABASE_UNAVAILABLE"],
    [known("P1017"), "DATABASE_UNAVAILABLE"],
    [init("P1002"), "DATABASE_TIMEOUT"],
    [known("P1008"), "DATABASE_TIMEOUT"],
    [known("P2024"), "DATABASE_TIMEOUT"],
    [known("P2028"), "UNEXPECTED_CHECKOUT_ERROR"],
    [init("P1000"), "UNEXPECTED_CHECKOUT_ERROR"],
    [
      Object.assign(new Error("Timeout P1001 database unavailable"), {
        code: "P1001",
      }),
      "UNEXPECTED_CHECKOUT_ERROR",
    ],
    [{ code: "P1001", message: sensitiveMessage }, "UNEXPECTED_CHECKOUT_ERROR"],
    [new Error(sensitiveMessage), "UNEXPECTED_CHECKOUT_ERROR"],
  ];
  for (const [error, code] of cases) {
    t.mock.method(checkoutRepository, "createIdempotentCheckout", async () => {
      throw error;
    });
    const id = randomUUID();
    const response = await checkout(id);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      message: "Internal Server Error",
    });
    const entries = forRequest(id);
    assert.deepEqual(
      entries.map((entry) => entry.event),
      ["checkout.failed", "http.completed"],
    );
    assert.equal(entries[0].context.code, code);
    assert.equal(entries[1].context.code, "HTTP_SERVER_ERROR");
    assert.doesNotMatch(
      JSON.stringify(entries),
      /postgresql|private-|P1001|P2024|message|stack|meta/,
    );
  }
});

test("HTTP categories cover general outcomes without inferring business causes", async () => {
  for (const [status, code] of [
    [200, undefined],
    [302, undefined],
    [400, "HTTP_BAD_REQUEST"],
    [401, "HTTP_UNAUTHENTICATED"],
    [403, "HTTP_FORBIDDEN"],
    [404, "HTTP_NOT_FOUND"],
    [409, "HTTP_CONFLICT"],
    [422, "HTTP_CLIENT_ERROR"],
    [429, "HTTP_CLIENT_ERROR"],
    [500, "HTTP_SERVER_ERROR"],
    [503, "HTTP_SERVER_ERROR"],
  ]) {
    const id = randomUUID();
    const response = await fetch(`${baseUrl}/status/${status}`, {
      headers: { "X-Request-ID": id },
      redirect: "manual",
    });
    assert.equal(response.status, status);
    await response.text();
    const entries = forRequest(id);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].context.code, code);
    assert.equal(entries[0].context.status, status);
    assert.equal(entries[0].context.outcome, "finished");
  }
});

test("allowed diagnostic codes survive sanitization while arbitrary codes are dropped", () => {
  const entries = [];
  const log = createLogger({ sink: (line) => entries.push(JSON.parse(line)) });
  for (const code of [
    ...CHECKOUT_CONFLICT_CODES,
    "DATABASE_TIMEOUT",
    "DATABASE_UNAVAILABLE",
    "UNEXPECTED_CHECKOUT_ERROR",
  ]) {
    log.warn("checkout.conflict", { code, error: new Error("private-secret") });
    assert.equal(entries.at(-1).context.code, code);
    assert.doesNotMatch(JSON.stringify(entries.at(-1)), /private-secret|stack/);
  }
  for (const code of [
    "ARBITRARY_ERROR",
    "postgresql://private-secret",
    "INSUFFICIENT_STOCK\nprivate",
    { code: "DATABASE_TIMEOUT" },
  ]) {
    log.error("checkout.failed", { code });
    assert.equal(entries.at(-1).context.code, undefined);
  }
});
