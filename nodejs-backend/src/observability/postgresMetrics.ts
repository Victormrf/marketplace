import { performance } from "node:perf_hooks";
import type { PrismaClient } from "@prisma/client";
import { metrics } from "./metrics";
import type { Metrics } from "./metrics";

function bounded(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const number = Number(raw);
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : fallback;
}

export const databaseMetricsInterval = bounded(
  process.env.METRICS_DB_INTERVAL_MS,
  30000,
  10000,
  300000,
);
export const databaseMetricsTimeout = bounded(
  process.env.METRICS_DB_TIMEOUT_MS,
  2000,
  250,
  5000,
);

export async function readPostgresSnapshot(
  client: PrismaClient,
  timeoutMs = databaseMetricsTimeout,
) {
  return client.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(timeoutMs)}, true)`;
      const rows = await tx.$queryRaw<
        Array<{ connections: number; active: number }>
      >`
      SELECT count(*)::integer AS connections,
        count(*) FILTER (WHERE state = 'active' AND pid <> pg_backend_pid())::integer AS active
      FROM pg_stat_activity
      WHERE datname = current_database() AND backend_type = 'client backend'
    `;
      const snapshot = rows[0];
      if (
        !snapshot ||
        !Number.isInteger(snapshot.connections) ||
        !Number.isInteger(snapshot.active) ||
        snapshot.connections < 1 ||
        snapshot.active < 0 ||
        snapshot.active > snapshot.connections
      ) {
        throw new Error("Invalid aggregate database observation");
      }
      return snapshot;
    },
    { maxWait: timeoutMs, timeout: timeoutMs + 500 },
  );
}

export function createPostgresCollector(
  collect: () => Promise<{ connections: number; active: number }>,
  measurements: Metrics = metrics,
  intervalMs = databaseMetricsInterval,
) {
  let stopped = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> | undefined;

  function sample(): Promise<void> {
    if (!measurements.enabled || stopped) {
      return Promise.resolve();
    }
    if (pending) {
      return pending;
    }
    const started = performance.now();
    pending = (async () => {
      try {
        const snapshot = await collect();
        measurements.databaseResult(
          snapshot,
          (performance.now() - started) / 1000,
        );
      } catch {
        measurements.databaseResult(null, (performance.now() - started) / 1000);
      }
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  }

  async function tick() {
    await sample();
    if (!stopped) {
      timer = setTimeout(tick, intervalMs);
      timer.unref();
    }
  }

  return {
    start() {
      if (!stopped || !measurements.enabled) {
        return;
      }
      stopped = false;
      void tick();
    },
    sample,
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await pending;
    },
  };
}
