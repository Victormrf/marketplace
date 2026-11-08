import { Queue, Worker } from "bullmq";
import type { Job } from "bullmq";
import { discoverDeliveryProgressionJobs } from "./deliveryProgression";
import {
  DELIVERY_JOB_OPTIONS,
  classifyDeliveryFailure,
  DeliveryRetryableError,
  DeliveryTerminalError,
} from "./deliveryQueue";
import type { DeliveryQueueConfig } from "./deliveryQueue";
import { publishDeliveryJobs } from "./deliveryQueue";
import { ValidationError } from "../utils/customErrors";
import { logger } from "../utils/logger";
import type { Logger } from "../utils/logger";

export const DISCOVERY_QUEUE = "delivery-discovery";
export const DISCOVERY_JOB = "discover-deliveries-v1";
export const DISCOVERY_SCHEDULER = "delivery-discovery-v1";
export type DeliveryDiscoveryJob = { version: 1 };

export function parseDiscoveryJob(value: unknown): DeliveryDiscoveryJob {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    Object.keys(value)[0] !== "version" ||
    !("version" in value) ||
    value.version !== 1
  ) {
    throw new ValidationError("Invalid discovery job");
  }
  return { version: 1 };
}

export function discoveryInterval(env: NodeJS.ProcessEnv = process.env) {
  const interval = Number(env.DELIVERY_DISCOVERY_INTERVAL_MS ?? "300000");
  if (
    !Number.isSafeInteger(interval) ||
    interval < 60000 ||
    interval > 86400000
  ) {
    throw new ValidationError("Discovery interval must be 60000–86400000 ms");
  }
  return interval;
}

export function createDiscoveryQueue(
  config: DeliveryQueueConfig,
  log: Logger = logger,
) {
  const queue = new Queue<
    DeliveryDiscoveryJob,
    { confirmedPublications: number }
  >(DISCOVERY_QUEUE, {
    prefix: config.prefix,
    connection: {
      ...config.connection,
      maxRetriesPerRequest: 1,
      commandTimeout: 5000,
      enableOfflineQueue: false,
      retryStrategy: null,
    },
    defaultJobOptions: DELIVERY_JOB_OPTIONS,
    streams: { events: { maxLen: 1000 } },
  });
  queue.on("error", () =>
    log.error("delivery.discovery.failed", { code: "QUEUE_UNAVAILABLE" }),
  );
  return queue;
}

export async function configureDiscoveryScheduler(
  queue: ReturnType<typeof createDiscoveryQueue>,
  interval: number,
  log: Logger = logger,
) {
  // Operational guard cannot be bypassed with NODE_ENV=test.
  discoveryInterval({ DELIVERY_DISCOVERY_INTERVAL_MS: String(interval) });
  await queue.upsertJobScheduler(
    DISCOVERY_SCHEDULER,
    { every: interval },
    { name: DISCOVERY_JOB, data: { version: 1 }, opts: DELIVERY_JOB_OPTIONS },
  );
  log.info("delivery.discovery.configured");
}

export async function removeDiscoveryScheduler(
  queue: ReturnType<typeof createDiscoveryQueue>,
  log: Logger = logger,
) {
  const removed = await queue.removeJobScheduler(DISCOVERY_SCHEDULER);
  log.info("delivery.discovery.removed");
  return removed;
}

type ProgressionQueue = Parameters<typeof publishDeliveryJobs>[0];
type Discovery = typeof discoverDeliveryProgressionJobs;

export function discoveryProcessor(
  progression: ProgressionQueue,
  discover: () => ReturnType<Discovery> = discoverDeliveryProgressionJobs,
  log: Logger = logger,
) {
  return async (job: Pick<Job, "name" | "data" | "attemptsMade">) => {
    try {
      if (job.name !== DISCOVERY_JOB) {
        throw new ValidationError("Invalid discovery job name");
      }
      parseDiscoveryJob(job.data);
      log.info("delivery.discovery.started");
      const confirmedPublications = await publishDeliveryJobs(
        progression,
        discover(),
        log,
      );
      log.info("delivery.discovery.completed", {
        count: confirmedPublications,
      });
      return { confirmedPublications };
    } catch (original) {
      const failure = classifyDeliveryFailure(original);
      log[failure.transient && job.attemptsMade + 1 < 3 ? "warn" : "error"](
        "delivery.discovery.failed",
        { code: failure.code, attempt: job.attemptsMade + 1 },
      );
      throw failure.transient
        ? new DeliveryRetryableError(failure.code, original)
        : new DeliveryTerminalError(failure.code, original);
    }
  };
}

export async function createDiscoveryWorker(
  config: DeliveryQueueConfig,
  discoveryQueue: ReturnType<typeof createDiscoveryQueue>,
  progression: ProgressionQueue,
  discover?: () => ReturnType<Discovery>,
  log: Logger = logger,
) {
  // Redis-enforced across every process using this queue/prefix, before run().
  await discoveryQueue.setGlobalConcurrency(1);
  const worker = new Worker(
    DISCOVERY_QUEUE,
    discoveryProcessor(progression, discover, log),
    {
      prefix: config.prefix,
      connection: { ...config.connection, maxRetriesPerRequest: null },
      concurrency: 1,
      autorun: false,
      maxStalledCount: 1,
      maxStartedAttempts: 3,
    },
  );
  worker.on("error", () =>
    log.error("delivery.discovery.failed", { code: "QUEUE_UNAVAILABLE" }),
  );
  worker.on("failed", (_job, error) => {
    if (
      !(error instanceof DeliveryRetryableError) &&
      !(error instanceof DeliveryTerminalError)
    ) {
      log.error("delivery.discovery.failed", {
        code: "UNEXPECTED_DELIVERY_JOB_ERROR",
      });
    }
  });
  return worker;
}
