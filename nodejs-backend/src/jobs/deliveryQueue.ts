import { Queue, Worker, UnrecoverableError } from "bullmq";
import type { RedisOptions, Job, JobsOptions } from "bullmq";
import { Prisma } from "@prisma/client";
import { processDeliveryProgressionJob } from "./deliveryProgression";
import {
  deliveryProgressionJobId,
  parseDeliveryProgressionJob,
} from "../types/deliveryProgression";
import type {
  DeliveryProgressionJob,
  DeliveryProgressionResult,
} from "../types/deliveryProgression";
import { ValidationError } from "../utils/customErrors";
import { logger } from "../utils/logger";
import type { Logger } from "../utils/logger";

export const DELIVERY_QUEUE = "delivery-progression";
export const DELIVERY_JOB = "advance-delivery-v1";
export const DELIVERY_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { age: 86400, count: 1000 },
  removeOnFail: { age: 604800, count: 500 },
  stackTraceLimit: 1,
};

export type DeliveryQueueConfig = {
  connection: RedisOptions;
  prefix: string;
  concurrency: number;
};

export function deliveryQueueConfig(
  env: NodeJS.ProcessEnv = process.env,
): DeliveryQueueConfig {
  let url: URL;
  try {
    url = new URL(env.DELIVERY_REDIS_URL ?? "");
  } catch {
    throw new ValidationError("DELIVERY_REDIS_URL is required");
  }
  const db =
    url.pathname === "/" || url.pathname === ""
      ? 0
      : Number(url.pathname.slice(1));
  const concurrency = Number(env.DELIVERY_WORKER_CONCURRENCY ?? "1");
  const prefix = env.DELIVERY_QUEUE_PREFIX ?? "marketplace-delivery";
  if (
    !["redis:", "rediss:"].includes(url.protocol) ||
    !url.hostname ||
    url.search ||
    url.hash ||
    !Number.isInteger(db) ||
    db < 0 ||
    db > 15 ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 4 ||
    !/^[a-z0-9-]{1,80}$/.test(prefix)
  ) {
    throw new ValidationError("Invalid delivery queue configuration");
  }
  return {
    prefix,
    concurrency,
    connection: {
      host: url.hostname,
      port: Number(url.port || 6379),
      db,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      tls: url.protocol === "rediss:" ? {} : undefined,
      connectTimeout: 3000,
    },
  };
}

export const DELIVERY_FAILURE_CODES = [
  "INVALID_DELIVERY_JOB",
  "DATABASE_UNAVAILABLE",
  "DATABASE_TIMEOUT",
  "DATABASE_RETRYABLE_CONFLICT",
  "UNEXPECTED_DELIVERY_JOB_ERROR",
] as const;
type FailureCode = (typeof DELIVERY_FAILURE_CODES)[number];
export function classifyDeliveryFailure(error: unknown): {
  code: FailureCode;
  transient: boolean;
} {
  if (error instanceof ValidationError) {
    return { code: "INVALID_DELIVERY_JOB", transient: false };
  }
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : error instanceof Prisma.PrismaClientInitializationError
        ? error.errorCode
        : undefined;
  if (code === "P1001" || code === "P1017") {
    return { code: "DATABASE_UNAVAILABLE", transient: true };
  }
  if (["P1002", "P1008", "P2024"].includes(code ?? "")) {
    return { code: "DATABASE_TIMEOUT", transient: true };
  }
  if (code === "P2034") {
    return { code: "DATABASE_RETRYABLE_CONFLICT", transient: true };
  }
  return { code: "UNEXPECTED_DELIVERY_JOB_ERROR", transient: false };
}

export class DeliveryRetryableError extends Error {
  readonly cause: unknown;
  constructor(
    readonly code: FailureCode,
    original: unknown,
  ) {
    super(code);
    this.stack = code;
    Object.defineProperty(this, "cause", { value: original });
  }
}
export class DeliveryTerminalError extends UnrecoverableError {
  readonly cause: unknown;
  constructor(
    readonly code: FailureCode,
    original: unknown,
  ) {
    super(code);
    this.stack = code;
    Object.defineProperty(this, "cause", { value: original });
  }
}

export function createDeliveryQueue(
  config: DeliveryQueueConfig,
  log: Logger = logger,
) {
  const queue = new Queue<DeliveryProgressionJob, DeliveryProgressionResult>(
    DELIVERY_QUEUE,
    {
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
    },
  );
  queue.on("error", () =>
    log.error("delivery.queue.failed", { code: "QUEUE_UNAVAILABLE" }),
  );
  return queue;
}

export async function publishDeliveryJobs(
  queue: {
    add(
      name: string,
      data: DeliveryProgressionJob,
      options: JobsOptions,
    ): Promise<unknown>;
  },
  candidates: AsyncIterable<DeliveryProgressionJob>,
  log: Logger = logger,
  signal?: AbortSignal,
): Promise<number> {
  let count = 0;
  if (signal?.aborted) {
    throw new Error("Publication interrupted");
  }
  for await (const candidate of candidates) {
    if (signal?.aborted) {
      throw new Error("Publication interrupted");
    }
    const payload = parseDeliveryProgressionJob(candidate);
    const jobId = deliveryProgressionJobId(payload);
    try {
      await queue.add(DELIVERY_JOB, payload, {
        ...DELIVERY_JOB_OPTIONS,
        jobId,
      });
    } catch (error) {
      // Preserve the identity for read-only reconciliation after a lost response.
      log.error("delivery.queue.failed", {
        code: "QUEUE_PUBLICATION_FAILED",
        jobId,
      });
      throw error;
    }
    count++;
    log.info("delivery.job.published", { jobId });
  }
  if (signal?.aborted) {
    throw new Error("Publication interrupted");
  }
  log.info("delivery.publication.completed", { count });
  return count;
}

export async function inspectDeliveryJob(
  queue: Pick<
    Queue<DeliveryProgressionJob, DeliveryProgressionResult>,
    "getJob"
  >,
  id: unknown,
) {
  if (
    typeof id !== "string" ||
    !/^delivery-progression-v1-[a-f0-9]{64}$/.test(id)
  ) {
    throw new ValidationError("Invalid delivery job identity");
  }
  const job = await queue.getJob(id);
  if (!job) {
    return { id, state: "missing" };
  }
  return {
    id,
    state: await job.getState(),
    attempts: job.attemptsMade,
    started: job.attemptsStarted,
    outcome: ["applied", "ignored"].includes(job.returnvalue?.outcome)
      ? job.returnvalue.outcome
      : undefined,
    code: DELIVERY_FAILURE_CODES.find((code) => code === job.failedReason),
  };
}

export function deliveryProcessor(
  processJob: (
    payload: unknown,
  ) => Promise<DeliveryProgressionResult> = processDeliveryProgressionJob,
  log: Logger = logger,
) {
  return async (job: Pick<Job, "name" | "data" | "id" | "attemptsMade">) => {
    try {
      if (job.name !== DELIVERY_JOB) {
        throw new ValidationError("Invalid delivery job name");
      }
      const payload = parseDeliveryProgressionJob(job.data);
      const result = await processJob(payload);
      // Do not persist a complete Delivery DTO in the queue return value.
      const safeResult: DeliveryProgressionResult = {
        deliveryId: payload.deliveryId,
        outcome: result.outcome,
      };
      log.info("delivery.job.completed", {
        jobId: job.id,
        jobOutcome: result.outcome,
      });
      return safeResult;
    } catch (original) {
      const failure = classifyDeliveryFailure(original);
      log[failure.transient && job.attemptsMade + 1 < 3 ? "warn" : "error"](
        "delivery.job.failed",
        {
          code: failure.code,
          jobId: job.id,
          attempt: job.attemptsMade + 1,
        },
      );
      // BullMQ persists messages/stacks: expose only safe codes there as well.
      throw failure.transient
        ? new DeliveryRetryableError(failure.code, original)
        : new DeliveryTerminalError(failure.code, original);
    }
  };
}

export function createDeliveryWorker(
  config: DeliveryQueueConfig,
  processJob?: (payload: unknown) => Promise<DeliveryProgressionResult>,
  log: Logger = logger,
) {
  const worker = new Worker(
    DELIVERY_QUEUE,
    deliveryProcessor(processJob, log),
    {
      prefix: config.prefix,
      connection: { ...config.connection, maxRetriesPerRequest: null },
      concurrency: config.concurrency,
      autorun: false,
      maxStalledCount: 1,
      maxStartedAttempts: 3,
    },
  );
  worker.on("error", () =>
    log.error("delivery.queue.failed", { code: "QUEUE_UNAVAILABLE" }),
  );
  worker.on("failed", (_job, error) => {
    if (
      !(error instanceof DeliveryRetryableError) &&
      !(error instanceof DeliveryTerminalError)
    ) {
      log.error("delivery.job.failed", {
        code: "UNEXPECTED_DELIVERY_JOB_ERROR",
      });
    }
  });
  return worker;
}

export async function queueDeadline<T>(
  operation: Promise<T>,
  milliseconds: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Queue operation deadline")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function closeDeliveryWorker(
  worker: Pick<Worker, "close" | "disconnect">,
  disconnectDatabase: () => Promise<void>,
  timeoutMs = 15000,
  log: Logger = logger,
): Promise<boolean> {
  try {
    await queueDeadline(
      (async () => {
        await worker.close();
        await disconnectDatabase();
      })(),
      timeoutMs,
    );
    log.info("delivery.worker.stopped");
    return true;
  } catch {
    log.error("delivery.worker.stopped", {
      code: "WORKER_SHUTDOWN_INCOMPLETE",
    });
    await queueDeadline(
      Promise.allSettled([worker.disconnect(), disconnectDatabase()]),
      1000,
    ).catch(() => undefined);
    return false;
  }
}
