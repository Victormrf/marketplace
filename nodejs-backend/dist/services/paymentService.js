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
exports.PaymentService = void 0;
const paymentModel_1 = require("../models/paymentModel");
const customErrors_1 = require("../utils/customErrors");
class PaymentService {
    processPayment(orderId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!orderId || typeof amount !== "number" || amount <= 0) {
                throw new customErrors_1.ValidationError("Missing or invalid required fields");
            }
            return yield paymentModel_1.PaymentModel.create({
                orderId,
                amount,
                status: "PENDING",
            });
        });
    }
    getPaymentDetails(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const payment = yield paymentModel_1.PaymentModel.getByOrderId(orderId);
            if (!payment) {
                throw new customErrors_1.ObjectNotFoundError("Payment");
            }
            return payment;
        });
    }
    getPaymentsByCustomer(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const payments = yield paymentModel_1.PaymentModel.getByCustomer(customerId);
            if (!payments.length) {
                throw new customErrors_1.ObjectsNotFoundError("Payments");
            }
            return payments;
        });
    }
    updatePayment(paymentId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const payment = yield paymentModel_1.PaymentModel.getById(paymentId);
            if (!payment) {
                throw new customErrors_1.ObjectNotFoundError("Payment");
            }
            try {
                return yield paymentModel_1.PaymentModel.update(paymentId, data);
            }
            catch (error) {
                throw new Error(`Failed to update payment: ${error.message}`);
            }
        });
    }
    updatePaymentStatus(paymentId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const payment = yield paymentModel_1.PaymentModel.getById(paymentId);
            if (!payment) {
                throw new customErrors_1.ObjectNotFoundError("Payment");
            }
            try {
                return yield paymentModel_1.PaymentModel.updateStatus(paymentId, status);
            }
            catch (error) {
                throw new Error(`Failed to update payment status: ${error.message}`);
            }
        });
    }
    deletePayment(paymentId) {
        return __awaiter(this, void 0, void 0, function* () {
            const payment = yield paymentModel_1.PaymentModel.getById(paymentId);
            if (!payment) {
                throw new customErrors_1.ObjectNotFoundError("Payment");
            }
            return yield paymentModel_1.PaymentModel.delete(paymentId);
        });
    }
}
exports.PaymentService = PaymentService;
