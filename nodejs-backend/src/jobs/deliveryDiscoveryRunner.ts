import prisma from "../config/db";
import {
  closeDeliveryWorker,
  createDeliveryQueue,
  deliveryQueueConfig,
  queueDeadline,
} from "./deliveryQueue";
import {
  configureDiscoveryScheduler,
  createDiscoveryQueue,
  createDiscoveryWorker,
  discoveryInterval,
  DISCOVERY_SCHEDULER,
  removeDiscoveryScheduler,
} from "./deliveryDiscovery";
import { logger } from "../utils/logger";

async function main() {
  const action = process.argv[2];
  if (!["configure", "status", "remove", "worker"].includes(action)) {
    throw new Error("Explicit discovery action required");
  }
  const interval = action === "configure" ? discoveryInterval() : undefined;
  if (action === "worker" && !process.env.DATABASE_URL) {
    throw new Error("Explicit database configuration required");
  }
  const config = deliveryQueueConfig();
  const queue = createDiscoveryQueue(config);
  let progression: ReturnType<typeof createDeliveryQueue> | undefined;
  let worker: Awaited<ReturnType<typeof createDiscoveryWorker>> | undefined;
  let stopping = false;
  const disconnect = async () => {
    const queues = progression ? [queue, progression] : [queue];
    const results = await Promise.allSettled(
      queues.map(async (connection) => {
        try {
          await queueDeadline(connection.close(), 4000);
        } catch (error) {
          await connection.disconnect();
          throw error;
        }
      }),
    );
    await prisma.$disconnect();
    if (results.some((result) => result.status === "rejected")) {
      throw new Error("Discovery shutdown incomplete");
    }
  };
  const stop = async () => {
    if (stopping) {
      return;
    }
    stopping = true;
    const normal = worker
      ? await closeDeliveryWorker(worker, disconnect)
      : await queueDeadline(disconnect(), 5000).then(
          () => true,
          () => false,
        );
    if (!normal) {
      logger.error("delivery.discovery.stopped", {
        code: "WORKER_SHUTDOWN_INCOMPLETE",
      });
      await Promise.allSettled([queue.disconnect(), progression?.disconnect()]);
    }
    if (normal) {
      logger.info("delivery.discovery.stopped");
    }
    process.exit(normal ? 0 : 1);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await queueDeadline(queue.waitUntilReady(), 5000);
    if (action === "configure") {
      await configureDiscoveryScheduler(queue, interval!);
    } else if (action === "remove") {
      await removeDiscoveryScheduler(queue);
    } else if (action === "status") {
      const scheduler = await queue.getJobScheduler(DISCOVERY_SCHEDULER);
      console.log(
        JSON.stringify({
          scheduler: scheduler
            ? {
                id: DISCOVERY_SCHEDULER,
                every: scheduler.every,
                next: scheduler.next,
              }
            : null,
          globalConcurrency: await queue.getGlobalConcurrency(),
          counts: await queue.getJobCounts(
            "waiting",
            "active",
            "delayed",
            "completed",
            "failed",
          ),
        }),
      );
    } else {
      progression = createDeliveryQueue(config);
      await queueDeadline(progression.waitUntilReady(), 5000);
      worker = await createDiscoveryWorker(config, queue, progression);
      await queueDeadline(worker.waitUntilReady(), 5000);
      await worker.run();
    }
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    if (worker) {
      const closed = await closeDeliveryWorker(worker, disconnect);
      if (!closed) {
        logger.error("delivery.discovery.stopped", {
          code: "WORKER_SHUTDOWN_INCOMPLETE",
        });
        await Promise.allSettled([
          queue.disconnect(),
          progression?.disconnect(),
        ]);
        process.exit(1);
      }
    } else {
      await queueDeadline(disconnect(), 5000);
    }
  }
}

if (require.main === module) {
  main().catch(async () => {
    logger.error("delivery.discovery.failed", { code: "QUEUE_UNAVAILABLE" });
    await prisma.$disconnect();
    process.exitCode = 1;
  });
}
