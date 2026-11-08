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
const logger_1 = require("../utils/logger");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.DATABASE_URL) {
            throw new Error("Explicit database configuration required");
        }
        const worker = (0, deliveryQueue_1.createDeliveryWorker)((0, deliveryQueue_1.deliveryQueueConfig)());
        let stopping = false;
        const stop = (...args_1) => __awaiter(this, [...args_1], void 0, function* (failure = false) {
            if (stopping) {
                return;
            }
            stopping = true;
            const normal = yield (0, deliveryQueue_1.closeDeliveryWorker)(worker, () => db_1.default.$disconnect());
            process.exit(normal && !failure ? 0 : 1);
        });
        process.once("SIGINT", () => void stop());
        process.once("SIGTERM", () => void stop());
        try {
            yield (0, deliveryQueue_1.queueDeadline)(worker.waitUntilReady(), 5000);
            logger_1.logger.info("delivery.worker.started");
            yield worker.run();
        }
        catch (_a) {
            logger_1.logger.error("delivery.queue.failed", { code: "QUEUE_UNAVAILABLE" });
            yield stop(true);
        }
    });
}
if (require.main === module) {
    main().catch(() => __awaiter(void 0, void 0, void 0, function* () {
        logger_1.logger.error("delivery.queue.failed", { code: "QUEUE_UNAVAILABLE" });
        yield db_1.default.$disconnect();
        process.exitCode = 1;
    }));
}
