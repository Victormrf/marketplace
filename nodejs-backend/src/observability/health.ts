import type { RequestHandler } from "express";
import type { PrismaClient } from "@prisma/client";

export async function checkDatabase(client: PrismaClient, timeoutMs = 1000) {
  await client.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(timeoutMs)}, true)`;
      await tx.$queryRaw`SELECT 1`;
    },
    { maxWait: timeoutMs, timeout: timeoutMs + 250 },
  );
}

export const liveness: RequestHandler = (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "live" });
};

export function readiness(
  check: () => Promise<void>,
  timeoutMs = 1500,
  cacheMs = 1000,
): RequestHandler {
  let pending: Promise<boolean> | undefined;
  let cached: { ready: boolean; until: number } | undefined;

  async function inspect(): Promise<boolean> {
    if (cached && cached.until > Date.now()) {
      return cached.ready;
    }
    if (pending) {
      return pending;
    }
    pending = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const deadline = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error("Readiness deadline")),
            timeoutMs,
          );
        });
        // Keep the single-flight guard until the actual DB probe settles, even
        // if the HTTP deadline wins. Do not accumulate queries during an outage.
        const actual = Promise.resolve().then(check);
        void actual
          .then(
            () => undefined,
            () => undefined,
          )
          .finally(() => {
            pending = undefined;
          });
        await Promise.race([actual, deadline]);
        cached = { ready: true, until: Date.now() + cacheMs };
        return true;
      } catch {
        cached = { ready: false, until: Date.now() + cacheMs };
        return false;
      } finally {
        clearTimeout(timer);
      }
    })();
    return pending;
  }

  return async (_req, res) => {
    const ready = await inspect();
    res.setHeader("Cache-Control", "no-store");
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? "ready" : "unavailable" });
  };
}
