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
// src/utils/deliveryStatusUpdater.ts
const db_1 = __importDefault(require("../config/db"));
var delivery_status;
(function (delivery_status) {
    delivery_status["SEPARATED"] = "SEPARATED";
    delivery_status["PROCESSING"] = "PROCESSING";
    delivery_status["SHIPPED"] = "SHIPPED";
    delivery_status["COLLECTED"] = "COLLECTED";
    delivery_status["ARRIVED_AT_CENTER"] = "ARRIVED_AT_CENTER";
    delivery_status["DELIVERED"] = "DELIVERED";
    delivery_status["FAILED"] = "FAILED";
    delivery_status["RETURNED"] = "RETURNED";
})(delivery_status || (delivery_status = {}));
function updateDeliveryStatuses() {
    return __awaiter(this, void 0, void 0, function* () {
        const deliveries = yield db_1.default.delivery.findMany();
        const statusFlow = {
            SEPARATED: delivery_status.PROCESSING,
            PROCESSING: delivery_status.SHIPPED,
            SHIPPED: delivery_status.COLLECTED,
            COLLECTED: delivery_status.ARRIVED_AT_CENTER,
            ARRIVED_AT_CENTER: delivery_status.DELIVERED,
            DELIVERED: null,
            FAILED: null,
            RETURNED: null,
        };
        for (const delivery of deliveries) {
            const nextStatus = statusFlow[delivery.status];
            if (!nextStatus)
                continue;
            const hoursSinceUpdate = (Date.now() - new Date(delivery.updatedAt).getTime()) / (1000 * 60 * 60);
            const shouldUpdate = (delivery.status === "SEPARATED" && hoursSinceUpdate >= 4) ||
                (delivery.status !== "SEPARATED" && hoursSinceUpdate >= 24);
            if (shouldUpdate) {
                yield db_1.default.delivery.update({
                    where: { id: delivery.id },
                    data: {
                        status: nextStatus,
                    },
                });
                yield db_1.default.deliveryStatusLog.create({
                    data: {
                        deliveryId: delivery.id,
                        status: nextStatus,
                    },
                });
                console.log(`🚚 Entrega ${delivery.id} atualizada para ${nextStatus}`);
            }
        }
    });
}
