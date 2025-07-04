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
exports.PaymentModel = void 0;
const db_1 = __importDefault(require("../config/db"));
class PaymentModel {
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.payment.create({ data });
        });
    }
    static getById(paymentId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.payment.findUnique({
                where: { id: paymentId },
            });
        });
    }
    static getByOrderId(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.payment.findUnique({
                where: { orderId },
                include: { order: true },
            });
        });
    }
    static getByCustomer(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.payment.findMany({
                where: {
                    order: { customerId },
                },
            });
        });
    }
    static update(paymentId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.payment.update({
                where: { id: paymentId },
                data,
            });
        });
    }
    static updateStatus(paymentId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.payment.update({
                where: { id: paymentId },
                data: { status },
            });
        });
    }
    static delete(paymentId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.payment.delete({
                where: { id: paymentId },
            });
        });
    }
}
exports.PaymentModel = PaymentModel;
