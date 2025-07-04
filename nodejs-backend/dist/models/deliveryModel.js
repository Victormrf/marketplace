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
exports.DeliveryModel = void 0;
const db_1 = __importDefault(require("../config/db"));
class DeliveryModel {
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.delivery.create({ data });
        });
    }
    static getByOrderId(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.delivery.findUnique({
                where: { orderId },
            });
        });
    }
    static updateStatus(orderId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.delivery.update({
                where: { orderId },
                data: { status },
            });
        });
    }
    static updateTracking(orderId, trackingCode, estimatedDelivery) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.delivery.update({
                where: { orderId },
                data: { trackingCode, estimatedDelivery },
            });
        });
    }
    static delete(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.delivery.delete({
                where: { orderId },
            });
        });
    }
}
exports.DeliveryModel = DeliveryModel;
