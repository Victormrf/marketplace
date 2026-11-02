import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";
import type { RequestHandler } from "express";
import { readFileSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { CHECKOUT_CONFLICT_CODES } from "../types/checkout";
import type {
  CheckoutConflictCode,
  CheckoutFailureCode,
} from "../types/checkout";

type HttpResult = {
  method: string;
  route: string;
  status: number | null;
  seconds: number;
  outcome: "finished" | "connection_closed";
};

// Instrumentation is best effort and never changes a business response.
function safely(operation: () => void): boolean {
  try {
    operation();
    return true;
  } catch {
    return false;
  }
}

export function createMetrics(enabled = false, processMetrics = true) {
  const registry = new Registry();
  const registers = enabled ? [registry] : [];
  const completed = new Counter({
    name: "marketplace_http_requests_total",
    help: "Completed HTTP responses, including 4xx and 5xx; excludes scrapes and aborted responses.",
    labelNames: ["method", "route", "status"] as const,
    registers,
  });
  const duration = new Histogram({
    name: "marketplace_http_request_duration_seconds",
    help: "HTTP duration through response finish; excludes aborted responses.",
    labelNames: ["method", "route", "status"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers,
  });
  const inFlight = new Gauge({
    name: "marketplace_http_requests_in_flight",
    help: "Application requests not yet finished or closed.",
    registers,
  });
  const closed = new Counter({
    name: "marketplace_http_connections_closed_total",
    help: "Requests closed before response finish; not completed HTTP responses.",
    labelNames: ["method", "route"] as const,
    registers,
  });
  const created = new Counter({
    name: "marketplace_checkout_created_total",
    help: "Checkout creations after transaction success; not replays.",
    registers,
  });
  const replayed = new Counter({
    name: "marketplace_checkout_replayed_total",
    help: "Successful idempotent checkout replays, not new purchases.",
    registers,
  });
  const conflicts = new Counter({
    name: "marketplace_checkout_conflicts_total",
    help: "Checkout business conflicts by safe code.",
    labelNames: ["code"] as const,
    registers,
  });
  const failures = new Counter({
    name: "marketplace_checkout_failures_total",
    help: "Unexpected checkout failures by safe classification.",
    labelNames: ["code"] as const,
    registers,
  });
  const queries = new Counter({
    name: "marketplace_prisma_queries_total",
    help: "Query events emitted by this Prisma client, including transaction control and monitoring SQL when emitted.",
    registers,
  });
  const queryDuration = new Histogram({
    name: "marketplace_prisma_query_duration_seconds",
    help: "Prisma query event duration, not request or transaction duration.",
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers,
  });
  const connections = new Gauge({
    name: "marketplace_postgres_connections",
    help: "Client sessions in the current database, including the monitoring connection; NaN when unavailable.",
    registers,
  });
  const activeSessions = new Gauge({
    name: "marketplace_postgres_active_sessions",
    help: "Active sessions visible to the database role, excluding the monitoring query; NaN when unavailable.",
    registers,
  });
  const databaseUp = new Gauge({
    name: "marketplace_postgres_collection_up",
    help: "1 if the last database collection succeeded, otherwise 0.",
    registers,
  });
  const databaseLastSuccess = new Gauge({
    name: "marketplace_postgres_last_success_timestamp_seconds",
    help: "Unix timestamp of last successful collection; 0 before first success.",
    registers,
  });
  const collectionErrors = new Counter({
    name: "marketplace_postgres_collection_errors_total",
    help: "Failed database collection attempts, without error text or SQL labels.",
    registers,
  });
  const collectionDuration = new Histogram({
    name: "marketplace_postgres_collection_duration_seconds",
    help: "Collector wall duration including connection acquisition and read-only transaction setup.",
    labelNames: ["outcome"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers,
  });

  if (enabled) {
    connections.set(Number.NaN);
    activeSessions.set(Number.NaN);
    if (processMetrics) {
      collectDefaultMetrics({ register: registry, prefix: "marketplace_" });
    }
  }

  const update = (operation: () => void) => {
    if (enabled) {
      safely(operation);
    }
  };

  return {
    enabled,
    registry,
    startHttp() {
      const counted = enabled && safely(() => inFlight.inc());
      let ended = false;
      return (result: HttpResult) => {
        if (ended || !enabled) {
          return;
        }
        ended = true;
        if (counted) {
          safely(() => inFlight.dec());
        }
        if (result.outcome === "connection_closed") {
          update(() =>
            closed.inc({ method: result.method, route: result.route }),
          );
        } else {
          const labels = {
            method: result.method,
            route: result.route,
            status: String(result.status),
          };
          update(() => completed.inc(labels));
          update(() => duration.observe(labels, result.seconds));
        }
      };
    },
    checkoutCreated: () => update(() => created.inc()),
    checkoutReplayed: () => update(() => replayed.inc()),
    checkoutConflict(code: CheckoutConflictCode) {
      if (CHECKOUT_CONFLICT_CODES.includes(code)) {
        update(() => conflicts.inc({ code }));
      }
    },
    checkoutFailed(code: CheckoutFailureCode) {
      if (
        [
          "DATABASE_UNAVAILABLE",
          "DATABASE_TIMEOUT",
          "UNEXPECTED_CHECKOUT_ERROR",
        ].includes(code)
      ) {
        update(() => failures.inc({ code }));
      }
    },
    query(milliseconds: number) {
      if (Number.isFinite(milliseconds) && milliseconds >= 0) {
        update(() => queries.inc());
        update(() => queryDuration.observe(milliseconds / 1000));
      }
    },
    databaseResult(
      snapshot: { connections: number; active: number } | null,
      seconds: number,
    ) {
      update(() => connections.set(snapshot?.connections ?? Number.NaN));
      update(() => activeSessions.set(snapshot?.active ?? Number.NaN));
      update(() => databaseUp.set(snapshot ? 1 : 0));
      update(() =>
        collectionDuration.observe(
          { outcome: snapshot ? "success" : "failure" },
          seconds,
        ),
      );
      if (snapshot) {
        update(() => databaseLastSuccess.set(Date.now() / 1000));
      } else {
        update(() => collectionErrors.inc());
      }
    },
  };
}

export type Metrics = ReturnType<typeof createMetrics>;
export const metrics = createMetrics(process.env.METRICS_ENABLED === "true");

export function isMetricsScrape(method: string, path: string): boolean {
  return (
    (method === "GET" || method === "HEAD") && /^\/metrics\/?$/i.test(path)
  );
}

export function metricsHandler(
  measurements: Metrics = metrics,
  remote: { addresses: string[]; token?: string } = remoteMetricsAccess(),
): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!measurements.enabled) {
      res.sendStatus(404);
      return;
    }
    const address = req.socket.remoteAddress ?? "";
    const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
    const supplied = req.header("Authorization") ?? "";
    const expected = remote.token ? `Bearer ${remote.token}` : "";
    const authorized =
      expected.length > 0 &&
      Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
    if (
      !local &&
      !(
        remote.addresses.includes(address.replace(/^::ffff:/, "")) && authorized
      )
    ) {
      res.sendStatus(403);
      return;
    }
    try {
      const body = await measurements.registry.metrics();
      res.type(measurements.registry.contentType).send(body);
    } catch {
      res.sendStatus(503);
    }
  };
}

function remoteMetricsAccess(): { addresses: string[]; token?: string } {
  const addresses = (process.env.METRICS_REMOTE_ADDRESSES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  try {
    const token = readFileSync(
      process.env.METRICS_REMOTE_TOKEN_FILE ?? "",
      "utf8",
    ).trim();
    return {
      addresses,
      token: /^[a-f0-9]{64}$/.test(token) ? token : undefined,
    };
  } catch {
    return { addresses: [] };
  }
}
