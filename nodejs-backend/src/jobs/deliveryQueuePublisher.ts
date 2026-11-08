import prisma from "../config/db";
import { discoverDeliveryProgressionJobs } from "./deliveryProgression";
import {
  createDeliveryQueue,
  deliveryQueueConfig,
  publishDeliveryJobs,
  queueDeadline,
  DELIVERY_FAILURE_CODES,
  inspectDeliveryJob,
} from "./deliveryQueue";
import { logger } from "../utils/logger";

async function main() {
  if (process.argv.includes("--job") && !process.argv.includes("--status")) {
    throw new Error("Job inspection requires --status");
  }
  const queue = createDeliveryQueue(deliveryQueueConfig());
  const abort = new AbortController();
  let shutdownTimer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    abort.abort();
    if (!shutdownTimer) {
      shutdownTimer = setTimeout(() => {
        logger.error("delivery.queue.failed", {
          code: "QUEUE_SHUTDOWN_INCOMPLETE",
        });
        void queue.disconnect().catch(() => undefined);
        void prisma.$disconnect().catch(() => undefined);
        process.exit(1);
      }, 15000);
    }
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await queueDeadline(queue.waitUntilReady(), 5000);
    if (process.argv.includes("--status")) {
      const identityIndex = process.argv.indexOf("--job");
      if (identityIndex >= 0) {
        console.log(
          JSON.stringify(
            await inspectDeliveryJob(queue, process.argv[identityIndex + 1]),
          ),
        );
        return;
      }
      const counts = await queue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
      );
      const failed = await queue.getJobs(["failed"], 0, 19);
      console.log(
        JSON.stringify({
          counts,
          failed: failed.map((job) => ({
            id: /^delivery-progression-v1-[a-f0-9]{64}$/.test(job.id ?? "")
              ? job.id
              : "[unrecognized]",
            attempts: job.attemptsMade,
            code: DELIVERY_FAILURE_CODES.find(
              (code) => code === job.failedReason,
            ),
          })),
        }),
      );
    } else {
      if (!process.env.DATABASE_URL) {
        throw new Error("Explicit database configuration required");
      }
      await publishDeliveryJobs(
        queue,
        discoverDeliveryProgressionJobs(),
        logger,
        abort.signal,
      );
    }
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    try {
      await queueDeadline(queue.close(), 4000).catch(async () => {
        await queue.disconnect();
        process.exitCode = 1;
      });
      await prisma.$disconnect();
    } finally {
      clearTimeout(shutdownTimer);
    }
  }
}

if (require.main === module) {
  main().catch(() => {
    logger.error("delivery.queue.failed", { code: "QUEUE_PUBLICATION_FAILED" });
    process.exitCode = 1;
  });
}
