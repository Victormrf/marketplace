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
exports.RefundService = void 0;
const refundModel_1 = require("../models/refundModel");
const customErrors_1 = require("../utils/customErrors");
class RefundService {
    requestRefund(paymentId, reason, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!paymentId || !reason || !amount) {
                throw new customErrors_1.ValidationError("Missing required fields");
            }
            return yield refundModel_1.RefundModel.create({
                paymentId,
                reason,
                amount,
                status: "REQUESTED",
            });
        });
    }
    getRefundById(refundId) {
        return __awaiter(this, void 0, void 0, function* () {
            const refund = yield refundModel_1.RefundModel.getById(refundId);
            if (!refund)
                throw new customErrors_1.ObjectNotFoundError("Refund");
            return refund;
        });
    }
    //   async getRefundsByCustomer(customerId: string) {
    //     const refunds = await RefundModel.getByCustomer(customerId);
    //     if (!refunds.length) throw new ObjectsNotFoundError("Refunds");
    //     return refunds;
    //   }
    updateRefundStatus(refundId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const refund = yield refundModel_1.RefundModel.getById(refundId);
            if (!refund)
                throw new customErrors_1.ObjectNotFoundError("Refund");
            return yield refundModel_1.RefundModel.updateStatus(refundId, status);
        });
    }
    deleteRefund(refundId) {
        return __awaiter(this, void 0, void 0, function* () {
            const refund = yield refundModel_1.RefundModel.getById(refundId);
            if (!refund)
                throw new customErrors_1.ObjectNotFoundError("Refund");
            return yield refundModel_1.RefundModel.delete(refundId);
        });
    }
}
exports.RefundService = RefundService;
