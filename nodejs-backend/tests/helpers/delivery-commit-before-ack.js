// Test-only process: commit a real transition and intentionally never acknowledge it.
const {
  prisma,
  redisUrl,
  allowedDeliveryIds,
} = require("./delivery-recovery-fixture");
const { Worker } = require("bullmq");
const { createLogger } = require("../../dist/utils/logger");
const {
  DELIVERY_QUEUE,
  deliveryQueueConfig,
  deliveryProcessor,
} = require("../../dist/jobs/deliveryQueue");
const {
  processDeliveryProgressionJob,
} = require("../../dist/jobs/deliveryProgression");
const quiet = createLogger({ sink() {} });
function createLeaseTestWorker(
  config,
  processJob = processDeliveryProgressionJob,
) {
  const worker = new Worker(
    DELIVERY_QUEUE,
    deliveryProcessor(processJob, quiet),
    {
      prefix: config.prefix,
      connection: { ...config.connection, maxRetriesPerRequest: null },
      autorun: false,
      concurrency: 1,
      maxStalledCount: 1,
      maxStartedAttempts: 3,
      // Only tests shorten lease/check timers. Operational worker configuration is unchanged.
      lockDuration: 1500,
      lockRenewTime: 500,
      stalledInterval: 500,
    },
  );
  worker.on("error", () => {});
  return worker;
}
async function main() {
  if (
    !process.send ||
    !/^delivery-recovery-test-[0-9a-f-]{36}$/.test(
      process.env.DELIVERY_QUEUE_PREFIX ?? "",
    )
  ) {
    throw new Error("Isolated test process requires IPC and test namespace");
  }
  const config = deliveryQueueConfig({
    ...process.env,
    DELIVERY_REDIS_URL: redisUrl.toString(),
  });
  const worker = createLeaseTestWorker(config, async (payload) => {
    if (!allowedDeliveryIds.includes(payload.deliveryId)) {
      throw new Error("Only recovery fixture deliveries are accepted");
    }
    const result = await processDeliveryProgressionJob(payload);
    process.send({ type: "committed", outcome: result.outcome });
    await new Promise(() => {});
    return result;
  });
  process.once("disconnect", () => process.exit(1));
  await worker.waitUntilReady();
  void worker.run().catch(() => {
    process.send?.({ type: "worker-failed" });
    process.exit(1);
  });
  process.send({ type: "ready" });
}
if (require.main === module) {
  main().catch(async () => {
    process.send?.({ type: "worker-failed" });
    await prisma.$disconnect();
    process.exit(1);
  });
}
module.exports = { createLeaseTestWorker };
