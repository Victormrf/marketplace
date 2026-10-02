import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }
    if (specifier.startsWith("@/")) {
      return {
        url: new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) {
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2020,
          },
        }).outputText,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

process.env.BACKEND_API_URL = "http://backend.test:8000";

const { NextRequest } = await import("next/server");
const proxy = await import("../lib/server/route-proxy.ts");
const dynamicRoute = await import("../app/api/[domain]/[[...path]]/route.ts");
const customerRoute = await import("../app/api/customers/route.ts");
const sellerRoute = await import("../app/api/sellers/route.ts");
const userRoute = await import("../app/api/users/me/route.ts");
const registerRoute = await import("../app/api/auth/register/route.ts");
const loginRoute = await import("../app/api/session/login/route.ts");
const logoutRoute = await import("../app/api/session/logout/route.ts");

function makeRequest(path, method = "GET", options = {}) {
  const url = `http://localhost:3000${path}`;
  const headers = new Headers(options.headers);
  let body = options.body;

  if (method !== "GET" && method !== "HEAD") {
    headers.set("origin", "http://localhost:3000");
    headers.set("sec-fetch-site", "same-origin");
  }

  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.json);
  }

  return new NextRequest(url, { method, headers, body });
}

function dynamicContext(domain, path = []) {
  return { params: Promise.resolve({ domain, path }) };
}

test("proxy forwards fixed target, auth/idempotency headers and preserves 409", async (t) => {
  let outboundUrl;
  let outboundHeaders;
  let outboundBody;
  t.mock.method(globalThis, "fetch", async (input, init) => {
    outboundUrl = new URL(input);
    outboundHeaders = new Headers(init.headers);
    outboundBody = init.body;
    return Response.json(
      { error: "checkout in progress" },
      {
        status: 409,
        headers: { "Idempotency-Replayed": "false" },
      },
    );
  });

  const request = makeRequest("/api/checkout?source=cart", "POST", {
    json: { addressId: "address-1" },
    headers: {
      cookie: "token=secret-token",
      "Idempotency-Key": "checkout-key-1",
    },
  });
  const response = await proxy.proxyBackendRequest(
    request,
    "/checkout",
    {
      requestHeaders: ["Idempotency-Key"],
      responseHeaders: ["Idempotency-Replayed"],
    },
  );

  assert.equal(outboundUrl.href, "http://backend.test:8000/checkout?source=cart");
  assert.equal(outboundHeaders.get("cookie"), "token=secret-token");
  assert.equal(outboundHeaders.get("idempotency-key"), "checkout-key-1");
  assert.equal(outboundHeaders.get("content-type"), "application/json");
  assert.equal(outboundBody, JSON.stringify({ addressId: "address-1" }));
  assert.equal(response.status, 409);
  assert.equal(response.headers.get("idempotency-replayed"), "false");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { error: "checkout in progress" });
});

test("proxy preserves 204 without inventing a response body", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  const response = await proxy.proxyBackendRequest(
    makeRequest("/api/cart"),
    "/cart",
  );

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("invalid incoming JSON returns 400 without calling the backend", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return Response.json({});
  });
  const response = await proxy.proxyBackendRequest(
    makeRequest("/api/checkout", "POST", {
      body: "{invalid",
      headers: { "content-type": "application/json" },
    }),
    "/checkout",
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid JSON body" });
  assert.equal(calls, 0);
});

test("multipart is forwarded as FormData without setting its boundary manually", async (t) => {
  let generatedContentType;
  let receivedFileName;
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const outbound = new Request(input, init);
    generatedContentType = outbound.headers.get("content-type");
    const form = await outbound.formData();
    receivedFileName = form.get("image").name;
    return Response.json({ id: "product-1" }, { status: 201 });
  });

  const form = new FormData();
  form.set("name", "Upload test");
  form.set("image", new Blob(["image-bytes"], { type: "image/png" }), "test.png");
  const request = makeRequest("/api/products", "POST", { body: form });
  const incomingContentType = request.headers.get("content-type");

  const response = await proxy.proxyBackendRequest(request, "/products");

  assert.match(generatedContentType, /^multipart\/form-data; boundary=/);
  assert.notEqual(generatedContentType, incomingContentType);
  assert.equal(receivedFileName, "test.png");
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: "product-1" });
});

test("proxy preserves a non-JSON backend error body and status", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    return new Response("upstream returned malformed JSON", {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  });
  const response = await proxy.proxyBackendRequest(
    makeRequest("/api/products"),
    "/products",
  );

  assert.equal(response.status, 502);
  assert.equal(await response.text(), "upstream returned malformed JSON");
  assert.equal(response.headers.get("content-type"), "application/json");
});

test("backend network failures become private 502 responses", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("connection refused");
  });
  const response = await proxy.proxyBackendRequest(
    makeRequest("/api/products"),
    "/products",
  );

  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { message: "Backend unavailable" });
});

test("cross-origin mutations are rejected before fetch", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return Response.json({});
  });
  const request = makeRequest("/api/cart/items", "POST", {
    json: { productId: "product-1", quantity: 1 },
  });
  request.headers.set("origin", "https://attacker.invalid");

  const response = await proxy.proxyBackendRequest(request, "/cart/items");

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(calls, 0);
});

test("dynamic allowlist retains payment-attempt lookup and refund routes only", async (t) => {
  const observed = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    observed.push({ url: new URL(input), method: init.method });
    return Response.json({ ok: true }, { status: init.method === "POST" ? 201 : 200 });
  });

  const paymentResponse = await dynamicRoute.GET(
    makeRequest("/api/payment-attempts/attempt-7"),
    dynamicContext("payment-attempts", ["attempt-7"]),
  );
  const listResponse = await dynamicRoute.GET(
    makeRequest("/api/payment-attempts/attempt-7/refunds"),
    dynamicContext("payment-attempts", ["attempt-7", "refunds"]),
  );
  const createResponse = await dynamicRoute.POST(
    makeRequest("/api/payment-attempts/attempt-7/refunds", "POST", {
      json: { amountInCents: 100, reason: "Test" },
    }),
    dynamicContext("payment-attempts", ["attempt-7", "refunds"]),
  );
  const blockedResponse = await dynamicRoute.POST(
    makeRequest("/api/payment-attempts/attempt-7", "POST", { json: {} }),
    dynamicContext("payment-attempts", ["attempt-7"]),
  );
  const unknownResponse = await dynamicRoute.GET(
    makeRequest("/api/unlisted/resource"),
    dynamicContext("unlisted", ["resource"]),
  );

  assert.equal(paymentResponse.status, 200);
  assert.equal(listResponse.status, 200);
  assert.equal(createResponse.status, 201);
  assert.equal(blockedResponse.status, 404);
  assert.equal(unknownResponse.status, 404);
  assert.deepEqual(
    observed.map(({ url, method }) => [url.pathname, method]),
    [
      ["/payment-attempts/attempt-7", "GET"],
      ["/payment-attempts/attempt-7/refunds", "GET"],
      ["/payment-attempts/attempt-7/refunds", "POST"],
    ],
  );
});

test("dedicated profile and registration handlers keep fixed targets and upstream statuses", async (t) => {
  const observed = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input);
    observed.push([url.pathname, init.method]);
    if (init.method === "POST") {
      return Response.json({ id: "created-profile" }, { status: 201 });
    }
    if (init.method === "PUT") {
      return new Response(null, { status: 204 });
    }
    return Response.json({ id: "profile" }, { status: 200 });
  });

  const customerRead = await customerRoute.GET(makeRequest("/api/customers"));
  const customerCreate = await customerRoute.POST(
    makeRequest("/api/customers", "POST", { json: { phone: "123" } }),
  );
  const sellerRead = await sellerRoute.GET(makeRequest("/api/sellers"));
  const sellerUpdate = await sellerRoute.PUT(
    makeRequest("/api/sellers", "PUT", { json: { storeName: "Updated" } }),
  );
  const userRead = await userRoute.GET(makeRequest("/api/users/me"));
  const userUpdate = await userRoute.PUT(
    makeRequest("/api/users/me", "PUT", { json: { name: "Updated" } }),
  );
  const registration = await registerRoute.POST(
    makeRequest("/api/auth/register", "POST", { json: { email: "new@test" } }),
  );

  assert.deepEqual(
    observed,
    [
      ["/customers/", "GET"],
      ["/customers/", "POST"],
      ["/sellers/", "GET"],
      ["/sellers/", "PUT"],
      ["/users/me", "GET"],
      ["/users/", "PUT"],
      ["/users/register", "POST"],
    ],
  );
  assert.equal(customerRead.status, 200);
  assert.equal(customerCreate.status, 201);
  assert.equal(sellerRead.status, 200);
  assert.equal(sellerUpdate.status, 204);
  assert.equal(userRead.status, 200);
  assert.equal(userUpdate.status, 204);
  assert.equal(registration.status, 201);
});

test("login captures backend token as HttpOnly cookie and logout clears it", async (t) => {
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (url.pathname === "/users/login") {
      return Response.json(
        { message: "Logged in" },
        { headers: { "Set-Cookie": "token=login-token; Path=/; HttpOnly" } },
      );
    }
    return new Response(null, { status: 204 });
  });

  const loginResponse = await loginRoute.POST(
    makeRequest("/api/session/login", "POST", { json: { email: "a@b.test" } }),
  );
  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.cookies.get("token")?.value, "login-token");
  assert.match(loginResponse.headers.get("set-cookie"), /HttpOnly/i);
  assert.deepEqual(await loginResponse.json(), { message: "Logged in" });

  const logoutResponse = await logoutRoute.POST(
    makeRequest("/api/session/logout", "POST", {
      headers: { cookie: "token=login-token" },
    }),
  );
  assert.equal(logoutResponse.status, 204);
  assert.equal(logoutResponse.cookies.get("token")?.value, "");
  assert.match(logoutResponse.headers.get("set-cookie"), /Max-Age=0/i);
});
