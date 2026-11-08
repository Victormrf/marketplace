"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryTerminalError = exports.DeliveryRetryableError = exports.DELIVERY_FAILURE_CODES = exports.DELIVERY_JOB_OPTIONS = exports.DELIVERY_JOB = exports.DELIVERY_QUEUE = void 0;
exports.deliveryQueueConfig = deliveryQueueConfig;
exports.classifyDeliveryFailure = classifyDeliveryFailure;
exports.createDeliveryQueue = createDeliveryQueue;
exports.publishDeliveryJobs = publishDeliveryJobs;
exports.inspectDeliveryJob = inspectDeliveryJob;
exports.deliveryProcessor = deliveryProcessor;
exports.createDeliveryWorker = createDeliveryWorker;
exports.queueDeadline = queueDeadline;
exports.closeDeliveryWorker = closeDeliveryWorker;
const bullmq_1 = require("bullmq");
const client_1 = require("@prisma/client");
const deliveryProgression_1 = require("./deliveryProgression");
const deliveryProgression_2 = require("../types/deliveryProgression");
const customErrors_1 = require("../utils/customErrors");
const logger_1 = require("../utils/logger");
exports.DELIVERY_QUEUE = "delivery-progression";
exports.DELIVERY_JOB = "advance-delivery-v1";
exports.DELIVERY_JOB_OPTIONS = {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800, count: 500 },
    stackTraceLimit: 1,
};
function deliveryQueueConfig(env = process.env) {
    var _a, _b, _c;
    let url;
    try {
        url = new URL((_a = env.DELIVERY_REDIS_URL) !== null && _a !== void 0 ? _a : "");
    }
    catch (_d) {
        throw new customErrors_1.ValidationError("DELIVERY_REDIS_URL is required");
    }
    const db = url.pathname === "/" || url.pathname === ""
        ? 0
        : Number(url.pathname.slice(1));
    const concurrency = Number((_b = env.DELIVERY_WORKER_CONCURRENCY) !== null && _b !== void 0 ? _b : "1");
    const prefix = (_c = env.DELIVERY_QUEUE_PREFIX) !== null && _c !== void 0 ? _c : "marketplace-delivery";
    if (!["redis:", "rediss:"].includes(url.protocol) ||
        !url.hostname ||
        url.search ||
        url.hash ||
        !Number.isInteger(db) ||
        db < 0 ||
        db > 15 ||
        !Number.isInteger(concurrency) ||
        concurrency < 1 ||
        concurrency > 4 ||
        !/^[a-z0-9-]{1,80}$/.test(prefix)) {
        throw new customErrors_1.ValidationError("Invalid delivery queue configuration");
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
exports.DELIVERY_FAILURE_CODES = [
    "INVALID_DELIVERY_JOB",
    "DATABASE_UNAVAILABLE",
    "DATABASE_TIMEOUT",
    "DATABASE_RETRYABLE_CONFLICT",
    "UNEXPECTED_DELIVERY_JOB_ERROR",
];
function classifyDeliveryFailure(error) {
    if (error instanceof customErrors_1.ValidationError) {
        return { code: "INVALID_DELIVERY_JOB", transient: false };
    }
    const code = error instanceof client_1.Prisma.PrismaClientKnownRequestError
        ? error.code
        : error instanceof client_1.Prisma.PrismaClientInitializationError
            ? error.errorCode
            : undefined;
    if (code === "P1001" || code === "P1017") {
        return { code: "DATABASE_UNAVAILABLE", transient: true };
    }
    if (["P1002", "P1008", "P2024"].includes(code !== null && code !== void 0 ? code : "")) {
        return { code: "DATABASE_TIMEOUT", transient: true };
    }
    if (code === "P2034") {
        return { code: "DATABASE_RETRYABLE_CONFLICT", transient: true };
    }
    return { code: "UNEXPECTED_DELIVERY_JOB_ERROR", transient: false };
}
class DeliveryRetryableError extends Error {
    constructor(code, original) {
        super(code);
        this.code = code;
        this.stack = code;
        Object.defineProperty(this, "cause", { value: original });
    }
}
exports.DeliveryRetryableError = DeliveryRetryableError;
class DeliveryTerminalError extends bullmq_1.UnrecoverableError {
    constructor(code, original) {
        super(code);
        this.code = code;
        this.stack = code;
        Object.defineProperty(this, "cause", { value: original });
    }
}
exports.DeliveryTerminalError = DeliveryTerminalError;
function createDeliveryQueue(config, log = logger_1.logger) {
    const queue = new bullmq_1.Queue(exports.DELIVERY_QUEUE, {
        prefix: config.prefix,
        connection: Object.assign(Object.assign({}, config.connection), { maxRetriesPerRequest: 1, commandTimeout: 5000, enableOfflineQueue: false, retryStrategy: null }),
        defaultJobOptions: exports.DELIVERY_JOB_OPTIONS,
        streams: { events: { maxLen: 1000 } },
    });
    queue.on("error", () => log.error("delivery.queue.failed", { code: "QUEUE_UNAVAILABLE" }));
    return queue;
}
function publishDeliveryJobs(queue_1, candidates_1) {
    return __awaiter(this, arguments, void 0, function* (queue, candidates, log = logger_1.logger, signal) {
        var _a, candidates_2, candidates_2_1;
        var _b, e_1, _c, _d;
        let count = 0;
        if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
            throw new Error("Publication interrupted");
        }
        try {
            for (_a = true, candidates_2 = __asyncValues(candidates); candidates_2_1 = yield candidates_2.next(), _b = candidates_2_1.done, !_b; _a = true) {
                _d = candidates_2_1.value;
                _a = false;
                const candidate = _d;
                if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                    throw new Error("Publication interrupted");
                }
                const payload = (0, deliveryProgression_2.parseDeliveryProgressionJob)(candidate);
                const jobId = (0, deliveryProgression_2.deliveryProgressionJobId)(payload);
                try {
                    yield queue.add(exports.DELIVERY_JOB, payload, Object.assign(Object.assign({}, exports.DELIVERY_JOB_OPTIONS), { jobId }));
                }
                catch (error) {
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
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_a && !_b && (_c = candidates_2.return)) yield _c.call(candidates_2);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
            throw new Error("Publication interrupted");
        }
        log.info("delivery.publication.completed", { count });
        return count;
    });
}
function inspectDeliveryJob(queue, id) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (typeof id !== "string" ||
            !/^delivery-progression-v1-[a-f0-9]{64}$/.test(id)) {
            throw new customErrors_1.ValidationError("Invalid delivery job identity");
        }
        const job = yield queue.getJob(id);
        if (!job) {
            return { id, state: "missing" };
        }
        return {
            id,
            state: yield job.getState(),
            attempts: job.attemptsMade,
            started: job.attemptsStarted,
            outcome: ["applied", "ignored"].includes((_a = job.returnvalue) === null || _a === void 0 ? void 0 : _a.outcome)
                ? job.returnvalue.outcome
                : undefined,
            code: exports.DELIVERY_FAILURE_CODES.find((code) => code === job.failedReason),
        };
    });
}
function deliveryProcessor(processJob = deliveryProgression_1.processDeliveryProgressionJob, log = logger_1.logger) {
    return (job) => __awaiter(this, void 0, void 0, function* () {
        try {
            if (job.name !== exports.DELIVERY_JOB) {
                throw new customErrors_1.ValidationError("Invalid delivery job name");
            }
            const payload = (0, deliveryProgression_2.parseDeliveryProgressionJob)(job.data);
            const result = yield processJob(payload);
            // Do not persist a complete Delivery DTO in the queue return value.
            const safeResult = {
                deliveryId: payload.deliveryId,
                outcome: result.outcome,
            };
            log.info("delivery.job.completed", {
                jobId: job.id,
                jobOutcome: result.outcome,
            });
            return safeResult;
        }
        catch (original) {
            const failure = classifyDeliveryFailure(original);
            log[failure.transient && job.attemptsMade + 1 < 3 ? "warn" : "error"]("delivery.job.failed", {
                code: failure.code,
                jobId: job.id,
                attempt: job.attemptsMade + 1,
            });
            // BullMQ persists messages/stacks: expose only safe codes there as well.
            throw failure.transient
                ? new DeliveryRetryableError(failure.code, original)
                : new DeliveryTerminalError(failure.code, original);
        }
    });
}
function createDeliveryWorker(config, processJob, log = logger_1.logger) {
    const worker = new bullmq_1.Worker(exports.DELIVERY_QUEUE, deliveryProcessor(processJob, log), {
        prefix: config.prefix,
        connection: Object.assign(Object.assign({}, config.connection), { maxRetriesPerRequest: null }),
        concurrency: config.concurrency,
        autorun: false,
        maxStalledCount: 1,
        maxStartedAttempts: 3,
    });
    worker.on("error", () => log.error("delivery.queue.failed", { code: "QUEUE_UNAVAILABLE" }));
    worker.on("failed", (_job, error) => {
        if (!(error instanceof DeliveryRetryableError) &&
            !(error instanceof DeliveryTerminalError)) {
            log.error("delivery.job.failed", {
                code: "UNEXPECTED_DELIVERY_JOB_ERROR",
            });
        }
    });
    return worker;
}
function queueDeadline(operation, milliseconds) {
    return __awaiter(this, void 0, void 0, function* () {
        let timer;
        try {
            return yield Promise.race([
                operation,
                new Promise((_resolve, reject) => {
                    timer = setTimeout(() => reject(new Error("Queue operation deadline")), milliseconds);
                }),
            ]);
        }
        finally {
            clearTimeout(timer);
        }
    });
}
function closeDeliveryWorker(worker_1, disconnectDatabase_1) {
    return __awaiter(this, arguments, void 0, function* (worker, disconnectDatabase, timeoutMs = 15000, log = logger_1.logger) {
        try {
            yield queueDeadline((() => __awaiter(this, void 0, void 0, function* () {
                yield worker.close();
                yield disconnectDatabase();
            }))(), timeoutMs);
            log.info("delivery.worker.stopped");
            return true;
        }
        catch (_a) {
            log.error("delivery.worker.stopped", {
                code: "WORKER_SHUTDOWN_INCOMPLETE",
            });
            yield queueDeadline(Promise.allSettled([worker.disconnect(), disconnectDatabase()]), 1000).catch(() => undefined);
            return false;
        }
    });
}
