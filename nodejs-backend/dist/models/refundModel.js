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
exports.RefundModel = void 0;
const db_1 = __importDefault(require("../config/db"));
class RefundModel {
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.refund.create({ data });
        });
    }
    static getById(refundId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.refund.findUnique({
                where: { id: refundId },
                include: { payment: true },
            });
        });
    }
    static getByPaymentId(paymentId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.refund.findMany({
                where: { paymentId },
            });
        });
    }
    static updateStatus(refundId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.refund.update({
                where: { id: refundId },
                data: { status },
            });
        });
    }
    static delete(refundId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.refund.delete({
                where: { id: refundId },
            });
        });
    }
}
exports.RefundModel = RefundModel;
