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
exports.updateDeliveryStatuses = updateDeliveryStatuses;
const db_1 = __importDefault(require("../config/db"));
const deliveryRepository_1 = require("../repositories/deliveryRepository");
const deliveryService_1 = require("../services/deliveryService");
const customErrors_1 = require("../utils/customErrors");
const BATCH_SIZE = 100;
function updateDeliveryStatuses() {
    return __awaiter(this, void 0, void 0, function* () {
        const repository = new deliveryRepository_1.DeliveryRepository();
        const service = new deliveryService_1.DeliveryService(repository);
        let afterId = null;
        while (true) {
            const deliveries = yield repository.findForJob(afterId, BATCH_SIZE);
            if (!deliveries.length)
                break;
            for (const delivery of deliveries) {
                afterId = delivery.id;
                const latestHistory = delivery.statusHistory[0];
                if (!latestHistory || latestHistory.toStatus !== delivery.status) {
                    continue;
                }
                const thresholdHours = delivery.status === "SEPARATED" ? 4 : 24;
                const eligibleBefore = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);
                if (latestHistory.changedAt > eligibleBefore)
                    continue;
                yield service
                    .advanceForJob(delivery.id, delivery.status, eligibleBefore, latestHistory.id)
                    .catch((error) => {
                    if (error instanceof customErrors_1.ConflictError)
                        return;
                    throw error;
                });
            }
            if (deliveries.length < BATCH_SIZE)
                break;
        }
    });
}
if (require.main === module) {
    updateDeliveryStatuses()
        .catch((error) => {
        console.error("Delivery status job failed", error);
        process.exitCode = 1;
    })
        .finally(() => __awaiter(void 0, void 0, void 0, function* () {
        yield db_1.default.$disconnect();
    }));
}
