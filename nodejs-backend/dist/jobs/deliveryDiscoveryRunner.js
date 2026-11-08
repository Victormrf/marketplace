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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("../config/db"));
const deliveryQueue_1 = require("./deliveryQueue");
const deliveryDiscovery_1 = require("./deliveryDiscovery");
const logger_1 = require("../utils/logger");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const action = process.argv[2];
        if (!["configure", "status", "remove", "worker"].includes(action)) {
            throw new Error("Explicit discovery action required");
        }
        const interval = action === "configure" ? (0, deliveryDiscovery_1.discoveryInterval)() : undefined;
        if (action === "worker" && !process.env.DATABASE_URL) {
            throw new Error("Explicit database configuration required");
        }
        const config = (0, deliveryQueue_1.deliveryQueueConfig)();
        const queue = (0, deliveryDiscovery_1.createDiscoveryQueue)(config);
        let progression;
        let worker;
        let stopping = false;
        const disconnect = () => __awaiter(this, void 0, void 0, function* () {
            const queues = progression ? [queue, progression] : [queue];
            const results = yield Promise.allSettled(queues.map((connection) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield (0, deliveryQueue_1.queueDeadline)(connection.close(), 4000);
                }
                catch (error) {
                    yield connection.disconnect();
                    throw error;
                }
            })));
            yield db_1.default.$disconnect();
            if (results.some((result) => result.status === "rejected")) {
                throw new Error("Discovery shutdown incomplete");
            }
        });
        const stop = () => __awaiter(this, void 0, void 0, function* () {
            if (stopping) {
                return;
            }
            stopping = true;
            const normal = worker
                ? yield (0, deliveryQueue_1.closeDeliveryWorker)(worker, disconnect)
                : yield (0, deliveryQueue_1.queueDeadline)(disconnect(), 5000).then(() => true, () => false);
            if (!normal) {
                logger_1.logger.error("delivery.discovery.stopped", {
                    code: "WORKER_SHUTDOWN_INCOMPLETE",
                });
                yield Promise.allSettled([queue.disconnect(), progression === null || progression === void 0 ? void 0 : progression.disconnect()]);
            }
            if (normal) {
                logger_1.logger.info("delivery.discovery.stopped");
            }
            process.exit(normal ? 0 : 1);
        });
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
        try {
            yield (0, deliveryQueue_1.queueDeadline)(queue.waitUntilReady(), 5000);
            if (action === "configure") {
                yield (0, deliveryDiscovery_1.configureDiscoveryScheduler)(queue, interval);
            }
            else if (action === "remove") {
                yield (0, deliveryDiscovery_1.removeDiscoveryScheduler)(queue);
            }
            else if (action === "status") {
                const scheduler = yield queue.getJobScheduler(deliveryDiscovery_1.DISCOVERY_SCHEDULER);
                console.log(JSON.stringify({
                    scheduler: scheduler
                        ? {
                            id: deliveryDiscovery_1.DISCOVERY_SCHEDULER,
                            every: scheduler.every,
                            next: scheduler.next,
                        }
                        : null,
                    globalConcurrency: yield queue.getGlobalConcurrency(),
                    counts: yield queue.getJobCounts("waiting", "active", "delayed", "completed", "failed"),
                }));
            }
            else {
                progression = (0, deliveryQueue_1.createDeliveryQueue)(config);
                yield (0, deliveryQueue_1.queueDeadline)(progression.waitUntilReady(), 5000);
                worker = yield (0, deliveryDiscovery_1.createDiscoveryWorker)(config, queue, progression);
                yield (0, deliveryQueue_1.queueDeadline)(worker.waitUntilReady(), 5000);
                yield worker.run();
            }
        }
        finally {
            process.off("SIGINT", stop);
            process.off("SIGTERM", stop);
            if (worker) {
                const closed = yield (0, deliveryQueue_1.closeDeliveryWorker)(worker, disconnect);
                if (!closed) {
                    logger_1.logger.error("delivery.discovery.stopped", {
                        code: "WORKER_SHUTDOWN_INCOMPLETE",
                    });
                    yield Promise.allSettled([
                        queue.disconnect(),
                        progression === null || progression === void 0 ? void 0 : progression.disconnect(),
                    ]);
                    process.exit(1);
                }
            }
            else {
                yield (0, deliveryQueue_1.queueDeadline)(disconnect(), 5000);
            }
        }
    });
}
if (require.main === module) {
    main().catch(() => __awaiter(void 0, void 0, void 0, function* () {
        logger_1.logger.error("delivery.discovery.failed", { code: "QUEUE_UNAVAILABLE" });
        yield db_1.default.$disconnect();
        process.exitCode = 1;
    }));
}
