import prisma from "../config/db";
import {
  createDeliveryWorker,
  deliveryQueueConfig,
  closeDeliveryWorker,
  queueDeadline,
} from "./deliveryQueue";
import { logger } from "../utils/logger";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Explicit database configuration required");
  }
  const worker = createDeliveryWorker(deliveryQueueConfig());
  let stopping = false;
  const stop = async (failure = false) => {
    if (stopping) {
      return;
    }
    stopping = true;
    const normal = await closeDeliveryWorker(worker, () =>
      prisma.$disconnect(),
    );
    process.exit(normal && !failure ? 0 : 1);
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
  try {
    await queueDeadline(worker.waitUntilReady(), 5000);
    logger.info("delivery.worker.started");
    await worker.run();
  } catch {
    logger.error("delivery.queue.failed", { code: "QUEUE_UNAVAILABLE" });
    await stop(true);
  }
}

if (require.main === module) {
  main().catch(async () => {
    logger.error("delivery.queue.failed", { code: "QUEUE_UNAVAILABLE" });
    await prisma.$disconnect();
    process.exitCode = 1;
  });
}
