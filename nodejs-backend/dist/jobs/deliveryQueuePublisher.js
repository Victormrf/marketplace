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
const deliveryProgression_1 = require("./deliveryProgression");
const deliveryQueue_1 = require("./deliveryQueue");
const logger_1 = require("../utils/logger");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        if (process.argv.includes("--job") && !process.argv.includes("--status")) {
            throw new Error("Job inspection requires --status");
        }
        const queue = (0, deliveryQueue_1.createDeliveryQueue)((0, deliveryQueue_1.deliveryQueueConfig)());
        const abort = new AbortController();
        let shutdownTimer;
        const stop = () => {
            abort.abort();
            if (!shutdownTimer) {
                shutdownTimer = setTimeout(() => {
                    logger_1.logger.error("delivery.queue.failed", {
                        code: "QUEUE_SHUTDOWN_INCOMPLETE",
                    });
                    void queue.disconnect().catch(() => undefined);
                    void db_1.default.$disconnect().catch(() => undefined);
                    process.exit(1);
                }, 15000);
            }
        };
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
        try {
            yield (0, deliveryQueue_1.queueDeadline)(queue.waitUntilReady(), 5000);
            if (process.argv.includes("--status")) {
                const identityIndex = process.argv.indexOf("--job");
                if (identityIndex >= 0) {
                    console.log(JSON.stringify(yield (0, deliveryQueue_1.inspectDeliveryJob)(queue, process.argv[identityIndex + 1])));
                    return;
                }
                const counts = yield queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
                const failed = yield queue.getJobs(["failed"], 0, 19);
                console.log(JSON.stringify({
                    counts,
                    failed: failed.map((job) => {
                        var _a;
                        return ({
                            id: /^delivery-progression-v1-[a-f0-9]{64}$/.test((_a = job.id) !== null && _a !== void 0 ? _a : "")
                                ? job.id
                                : "[unrecognized]",
                            attempts: job.attemptsMade,
                            code: deliveryQueue_1.DELIVERY_FAILURE_CODES.find((code) => code === job.failedReason),
                        });
                    }),
                }));
            }
            else {
                if (!process.env.DATABASE_URL) {
                    throw new Error("Explicit database configuration required");
                }
                yield (0, deliveryQueue_1.publishDeliveryJobs)(queue, (0, deliveryProgression_1.discoverDeliveryProgressionJobs)(), logger_1.logger, abort.signal);
            }
        }
        finally {
            process.off("SIGINT", stop);
            process.off("SIGTERM", stop);
            try {
                yield (0, deliveryQueue_1.queueDeadline)(queue.close(), 4000).catch(() => __awaiter(this, void 0, void 0, function* () {
                    yield queue.disconnect();
                    process.exitCode = 1;
                }));
                yield db_1.default.$disconnect();
            }
            finally {
                clearTimeout(shutdownTimer);
            }
        }
    });
}
if (require.main === module) {
    main().catch(() => {
        logger_1.logger.error("delivery.queue.failed", { code: "QUEUE_PUBLICATION_FAILED" });
        process.exitCode = 1;
    });
}
