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
exports.DeliveryService = void 0;
const deliveryModel_1 = require("../models/deliveryModel");
const customErrors_1 = require("../utils/customErrors");
class DeliveryService {
    createDelivery(orderId, status, trackingCode, estimatedDelivery) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!orderId || !status) {
                throw new customErrors_1.ValidationError("Missing required fields");
            }
            const updatedAt = new Date();
            return yield deliveryModel_1.DeliveryModel.create({
                orderId,
                status,
                trackingCode,
                estimatedDelivery,
                updatedAt,
            });
        });
    }
    getDeliveryDetails(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const delivery = yield deliveryModel_1.DeliveryModel.getByOrderId(orderId);
            if (!delivery) {
                throw new customErrors_1.ObjectNotFoundError("Delivery");
            }
            return delivery;
        });
    }
    updateDeliveryStatus(orderId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const delivery = yield deliveryModel_1.DeliveryModel.getByOrderId(orderId);
            if (!delivery) {
                throw new customErrors_1.ObjectNotFoundError("Delivery");
            }
            return yield deliveryModel_1.DeliveryModel.updateStatus(orderId, status);
        });
    }
    updateTrackingInfo(orderId, trackingCode, estimatedDelivery) {
        return __awaiter(this, void 0, void 0, function* () {
            const delivery = yield deliveryModel_1.DeliveryModel.getByOrderId(orderId);
            if (!delivery) {
                throw new customErrors_1.ObjectNotFoundError("Delivery");
            }
            return yield deliveryModel_1.DeliveryModel.updateTracking(orderId, trackingCode, estimatedDelivery);
        });
    }
    deleteDelivery(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const delivery = yield deliveryModel_1.DeliveryModel.getByOrderId(orderId);
            if (!delivery) {
                throw new customErrors_1.ObjectNotFoundError("Delivery");
            }
            return yield deliveryModel_1.DeliveryModel.delete(orderId);
        });
    }
}
exports.DeliveryService = DeliveryService;
