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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISCOVERY_SCHEDULER = exports.DISCOVERY_JOB = exports.DISCOVERY_QUEUE = void 0;
exports.parseDiscoveryJob = parseDiscoveryJob;
exports.discoveryInterval = discoveryInterval;
exports.createDiscoveryQueue = createDiscoveryQueue;
exports.configureDiscoveryScheduler = configureDiscoveryScheduler;
exports.removeDiscoveryScheduler = removeDiscoveryScheduler;
exports.discoveryProcessor = discoveryProcessor;
exports.createDiscoveryWorker = createDiscoveryWorker;
const bullmq_1 = require("bullmq");
const deliveryProgression_1 = require("./deliveryProgression");
const deliveryQueue_1 = require("./deliveryQueue");
const deliveryQueue_2 = require("./deliveryQueue");
const customErrors_1 = require("../utils/customErrors");
const logger_1 = require("../utils/logger");
exports.DISCOVERY_QUEUE = "delivery-discovery";
exports.DISCOVERY_JOB = "discover-deliveries-v1";
exports.DISCOVERY_SCHEDULER = "delivery-discovery-v1";
function parseDiscoveryJob(value) {
    if (!value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).length !== 1 ||
        Object.keys(value)[0] !== "version" ||
        !("version" in value) ||
        value.version !== 1) {
        throw new customErrors_1.ValidationError("Invalid discovery job");
    }
    return { version: 1 };
}
function discoveryInterval(env = process.env) {
    var _a;
    const interval = Number((_a = env.DELIVERY_DISCOVERY_INTERVAL_MS) !== null && _a !== void 0 ? _a : "300000");
    if (!Number.isSafeInteger(interval) ||
        interval < 60000 ||
        interval > 86400000) {
        throw new customErrors_1.ValidationError("Discovery interval must be 60000–86400000 ms");
    }
    return interval;
}
function createDiscoveryQueue(config, log = logger_1.logger) {
    const queue = new bullmq_1.Queue(exports.DISCOVERY_QUEUE, {
        prefix: config.prefix,
        connection: Object.assign(Object.assign({}, config.connection), { maxRetriesPerRequest: 1, commandTimeout: 5000, enableOfflineQueue: false, retryStrategy: null }),
        defaultJobOptions: deliveryQueue_1.DELIVERY_JOB_OPTIONS,
        streams: { events: { maxLen: 1000 } },
    });
    queue.on("error", () => log.error("delivery.discovery.failed", { code: "QUEUE_UNAVAILABLE" }));
    return queue;
}
function configureDiscoveryScheduler(queue_1, interval_1) {
    return __awaiter(this, arguments, void 0, function* (queue, interval, log = logger_1.logger) {
        // Operational guard cannot be bypassed with NODE_ENV=test.
        discoveryInterval({ DELIVERY_DISCOVERY_INTERVAL_MS: String(interval) });
        yield queue.upsertJobScheduler(exports.DISCOVERY_SCHEDULER, { every: interval }, { name: exports.DISCOVERY_JOB, data: { version: 1 }, opts: deliveryQueue_1.DELIVERY_JOB_OPTIONS });
        log.info("delivery.discovery.configured");
    });
}
function removeDiscoveryScheduler(queue_1) {
    return __awaiter(this, arguments, void 0, function* (queue, log = logger_1.logger) {
        const removed = yield queue.removeJobScheduler(exports.DISCOVERY_SCHEDULER);
        log.info("delivery.discovery.removed");
        return removed;
    });
}
function discoveryProcessor(progression, discover = deliveryProgression_1.discoverDeliveryProgressionJobs, log = logger_1.logger) {
    return (job) => __awaiter(this, void 0, void 0, function* () {
        try {
            if (job.name !== exports.DISCOVERY_JOB) {
                throw new customErrors_1.ValidationError("Invalid discovery job name");
            }
            parseDiscoveryJob(job.data);
            log.info("delivery.discovery.started");
            const confirmedPublications = yield (0, deliveryQueue_2.publishDeliveryJobs)(progression, discover(), log);
            log.info("delivery.discovery.completed", {
                count: confirmedPublications,
            });
            return { confirmedPublications };
        }
        catch (original) {
            const failure = (0, deliveryQueue_1.classifyDeliveryFailure)(original);
            log[failure.transient && job.attemptsMade + 1 < 3 ? "warn" : "error"]("delivery.discovery.failed", { code: failure.code, attempt: job.attemptsMade + 1 });
            throw failure.transient
                ? new deliveryQueue_1.DeliveryRetryableError(failure.code, original)
                : new deliveryQueue_1.DeliveryTerminalError(failure.code, original);
        }
    });
}
function createDiscoveryWorker(config_1, discoveryQueue_1, progression_1, discover_1) {
    return __awaiter(this, arguments, void 0, function* (config, discoveryQueue, progression, discover, log = logger_1.logger) {
        // Redis-enforced across every process using this queue/prefix, before run().
        yield discoveryQueue.setGlobalConcurrency(1);
        const worker = new bullmq_1.Worker(exports.DISCOVERY_QUEUE, discoveryProcessor(progression, discover, log), {
            prefix: config.prefix,
            connection: Object.assign(Object.assign({}, config.connection), { maxRetriesPerRequest: null }),
            concurrency: 1,
            autorun: false,
            maxStalledCount: 1,
            maxStartedAttempts: 3,
        });
        worker.on("error", () => log.error("delivery.discovery.failed", { code: "QUEUE_UNAVAILABLE" }));
        worker.on("failed", (_job, error) => {
            if (!(error instanceof deliveryQueue_1.DeliveryRetryableError) &&
                !(error instanceof deliveryQueue_1.DeliveryTerminalError)) {
                log.error("delivery.discovery.failed", {
                    code: "UNEXPECTED_DELIVERY_JOB_ERROR",
                });
            }
        });
        return worker;
    });
}
