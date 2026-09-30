import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { act } from "react";
import { create } from "react-test-renderer";
import ts from "typescript";

// Load the actual hook and HTTP service with the application's TS path alias.
registerHooks({
  resolve(specifier, context, nextResolve) {
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

const { useSellerDashboard } = await import("../hooks/useSellerDashboard.ts");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const initialRange = { from: "2026-09-01", to: "2026-09-30" };
const nextRange = { from: "2026-08-01", to: "2026-08-31" };

async function mountDashboard(t) {
  const requests = [];
  t.mock.method(globalThis, "fetch", (path) => {
    return new Promise((resolve, reject) => {
      requests.push({
        url: new URL(path, "http://localhost"),
        resolve(payload, status = 200) {
          resolve(Response.json(payload, { status }));
        },
        reject,
      });
    });
  });
  let current;
  let renderer;
  function Probe({ range, enabled }) {
    current = useSellerDashboard(range, enabled);
    return React.createElement(
      "output",
      null,
      JSON.stringify({
        data: current.data,
        loading: current.loading,
        error: current.error,
        errorStatus: current.errorStatus,
      }),
    );
  }
  async function render(range = initialRange, enabled = true) {
    await act(async () => {
      const element = React.createElement(Probe, { range, enabled });
      if (renderer) {
        renderer.update(element);
      } else {
        renderer = create(element);
      }
    });
  }
  await render();
  t.after(async () => {
    await act(async () => renderer.unmount());
  });
  return {
    requests,
    render,
    get current() {
      return current;
    },
    visible() {
      return JSON.parse(renderer.toJSON().children[0]);
    },
  };
}

function requestFor(requests, suffix) {
  return requests.find((request) => request.url.pathname.endsWith(suffix));
}

async function succeed(requests, marker) {
  await act(async () => {
    for (const request of requests) {
      request.resolve({ marker });
    }
  });
}

test("older period responses cannot replace the rendered latest results", async (t) => {
  const dashboard = await mountDashboard(t);
  const older = dashboard.requests.splice(0);
  await dashboard.render(nextRange);
  const latest = dashboard.requests.splice(0);
  assert.equal(older.length, 8);
  assert.equal(latest.length, 7); // Ratings do not depend on the period.
  await succeed([requestFor(older, "/ratings")], "ratings");
  await succeed(latest, "latest");
  const expected = dashboard.visible();
  assert.equal(expected.data.summary.marker, "latest");
  assert.equal(expected.data.orders.marker, "latest");
  assert.equal(expected.data.timeseries.marker, "latest");
  assert.equal(expected.loading, false);
  await succeed(older, "obsolete");
  assert.deepEqual(dashboard.visible(), expected);
});

test("stale errors and finally cannot overwrite current error or loading", async (t) => {
  const dashboard = await mountDashboard(t);
  await succeed(dashboard.requests.splice(0), "initial");
  await dashboard.render(nextRange);
  const older = dashboard.requests.splice(0);
  await dashboard.render({ from: "2026-07-01", to: "2026-07-31" });
  const latest = dashboard.requests.splice(0);
  await act(async () => {
    for (const request of older) {
      request.resolve({ error: "obsolete error" }, 503);
    }
  });
  assert.equal(dashboard.visible().loading, true);
  assert.equal(dashboard.visible().error, null);
  await act(async () => {
    requestFor(latest, "/summary").resolve({ error: "current analytics" }, 403);
  });
  await succeed(latest, "latest");
  assert.equal(dashboard.visible().loading, false);
  assert.equal(dashboard.visible().error, "current analytics");
  assert.equal(dashboard.visible().errorStatus, 403);

  await act(async () => dashboard.current.setPage(2));
  assert.equal(dashboard.visible().error, "current analytics");
  await succeed(dashboard.requests.splice(0), "page2");
  assert.equal(dashboard.visible().errorStatus, 403);
});

test("status, page and interval only reload dependent queries", async (t) => {
  const dashboard = await mountDashboard(t);
  await succeed(dashboard.requests.splice(0), "initial");
  await dashboard.render({ ...initialRange });
  assert.equal(dashboard.requests.length, 0);
  await act(async () => dashboard.current.setStatus("DELIVERED"));
  const older = dashboard.requests.splice(0);
  assert.equal(older.length, 1);
  assert.equal(older[0].url.searchParams.get("status"), "DELIVERED");
  await act(async () => dashboard.current.setPage(2));
  const latest = dashboard.requests.splice(0);
  assert.equal(latest.length, 1);
  assert.equal(latest[0].url.searchParams.get("page"), "2");
  await act(async () => dashboard.current.setInterval("month"));
  const timeseries = dashboard.requests.splice(0);
  assert.equal(timeseries.length, 1);
  assert.equal(timeseries[0].url.searchParams.get("interval"), "month");
  await succeed(timeseries, "month");
  await succeed(latest, "page2");
  await succeed(older, "obsolete");
  assert.equal(dashboard.visible().data.orders.marker, "page2");
  assert.equal(dashboard.visible().data.timeseries.marker, "month");
  assert.equal(dashboard.visible().loading, false);
});

test("interval responses are ignored out of order without invalidating orders", async (t) => {
  const dashboard = await mountDashboard(t);
  const older = dashboard.requests.splice(0);
  await act(async () => dashboard.current.setInterval("month"));
  const latest = dashboard.requests.splice(0);
  await succeed(latest, "month");
  await succeed(older, "initial");
  assert.equal(dashboard.visible().data.timeseries.marker, "month");
  assert.equal(dashboard.visible().data.orders.marker, "initial");
  assert.equal(dashboard.visible().loading, false);
});

test("refresh supersedes pending requests and preserves the latest orders error", async (t) => {
  const dashboard = await mountDashboard(t);
  const older = dashboard.requests.splice(0);
  let refreshing;
  await act(async () => {
    refreshing = dashboard.current.refresh();
  });
  const latest = dashboard.requests.splice(0);
  assert.equal(latest.length, 8);
  await act(async () => {
    requestFor(latest, "/orders").resolve({ error: "current orders" }, 409);
  });
  await succeed(latest, "refreshed");
  await refreshing;
  await act(async () => {
    for (const request of older) {
      request.resolve({ error: "obsolete" }, 503);
    }
  });
  assert.equal(dashboard.visible().error, "current orders");
  assert.equal(dashboard.visible().errorStatus, 409);
  assert.equal(dashboard.visible().loading, false);
  await act(async () => dashboard.current.setInterval("month"));
  await succeed(dashboard.requests.splice(0), "month");
  assert.equal(dashboard.visible().error, "current orders");
});

test("disable invalidates pending responses and refresh waits for re-enable", async (t) => {
  const dashboard = await mountDashboard(t);
  const older = dashboard.requests.splice(0);
  await dashboard.render(initialRange, false);
  const expected = dashboard.visible();
  await succeed(older, "obsolete");
  await act(async () => dashboard.current.refresh());
  assert.deepEqual(dashboard.visible(), expected);
  assert.equal(dashboard.requests.length, 0);
  assert.equal(expected.loading, false);
  await dashboard.render(initialRange, true);
  assert.equal(dashboard.requests.length, 8);
  await succeed(dashboard.requests.splice(0), "enabled");
  assert.equal(dashboard.visible().data.summary.marker, "enabled");
});
