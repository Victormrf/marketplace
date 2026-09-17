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
const client_1 = require("@prisma/client");
const customerRepository_1 = require("../repositories/customerRepository");
const refundRepository_1 = require("../repositories/refundRepository");
const refundProvider_1 = require("../providers/refundProvider");
const customErrors_1 = require("../utils/customErrors");
function toDto(record) {
    return {
        id: record.id,
        paymentAttemptId: record.paymentAttemptId,
        amountInCents: record.amountInCents,
        currency: record.currency,
        reason: record.reason,
        status: record.status,
        providerReference: record.providerReference,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        completedAt: record.completedAt,
        failedAt: record.failedAt,
    };
}
function normalizeReason(value) {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== "string") {
        throw new customErrors_1.ValidationError("reason must be a string");
    }
    const result = value.trim();
    if (result.length > 500) {
        throw new customErrors_1.ValidationError("reason is too long");
    }
    return result || null;
}
class RefundService {
    constructor(repository = new refundRepository_1.RefundRepository(), provider = new refundProvider_1.DevRefundProvider()) {
        this.repository = repository;
        this.provider = provider;
    }
    customerId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const profile = yield customerRepository_1.customerRepository.findByUserId(userId);
            if (!profile) {
                throw new customErrors_1.ForbiddenError("Only customers can access refunds");
            }
            return profile.id;
        });
    }
    requestRefund(user, paymentAttemptId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            let customerId = null;
            if (user.role === client_1.UserRole.CUSTOMER) {
                customerId = yield this.customerId(user.id);
            }
            else if (user.role !== client_1.UserRole.ADMIN) {
                throw new customErrors_1.ForbiddenError();
            }
            if (!Number.isInteger(input.amountInCents) || input.amountInCents <= 0) {
                throw new customErrors_1.ValidationError("amountInCents must be a positive integer");
            }
            const requested = yield this.repository.createRequested(customerId, paymentAttemptId, {
                amountInCents: input.amountInCents,
                reason: normalizeReason(input.reason),
            });
            const processing = yield this.repository.transition(requested.id, client_1.RefundStatus.PROCESSING);
            if (!processing) {
                throw new customErrors_1.ObjectNotFoundError("Refund");
            }
            return this.provisionRefund(processing.id);
        });
    }
    provisionRefund(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const current = yield this.repository.findForProvisioning(id);
            if (!current)
                throw new customErrors_1.ObjectNotFoundError("Refund");
            if (current.status !== client_1.RefundStatus.PROCESSING)
                throw new customErrors_1.ConflictError("Only PROCESSING refunds can be provisioned");
            if (!current.paymentAttempt.providerReference)
                throw new customErrors_1.ConflictError("Payment attempt has no provider reference");
            let external;
            try {
                external = yield this.provider.createRefund({
                    refundId: current.id,
                    paymentAttemptId: current.paymentAttemptId,
                    paymentProviderReference: current.paymentAttempt.providerReference,
                    amountInCents: current.amountInCents,
                    currency: current.currency,
                });
            }
            catch (error) {
                if (error instanceof refundProvider_1.RefundProviderDeclinedError) {
                    yield this.repository
                        .transition(current.id, client_1.RefundStatus.DECLINED)
                        .catch(() => undefined);
                }
                else if (error instanceof refundProvider_1.RefundProviderDefinitiveError) {
                    yield this.repository
                        .transition(current.id, client_1.RefundStatus.FAILED)
                        .catch(() => undefined);
                }
                throw error;
            }
            const withReference = yield this.repository.setProviderReference(current.id, external.providerReference);
            const completed = yield this.repository.transition(withReference.id, client_1.RefundStatus.COMPLETED);
            if (!completed)
                throw new customErrors_1.ObjectNotFoundError("Refund");
            return toDto(completed);
        });
    }
    list(user, paymentAttemptId, filters, page, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const customerId = user.role === client_1.UserRole.CUSTOMER
                ? yield this.customerId(user.id)
                : undefined;
            if (user.role !== client_1.UserRole.CUSTOMER && user.role !== client_1.UserRole.ADMIN)
                throw new customErrors_1.ForbiddenError();
            const [total, records] = yield Promise.all([
                this.repository.count(paymentAttemptId, filters, customerId),
                this.repository.findMany(paymentAttemptId, filters, (page - 1) * limit, limit, customerId),
            ]);
            return {
                data: records.map(toDto),
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            };
        });
    }
    get(user, id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (user.role === client_1.UserRole.SELLER)
                throw new customErrors_1.ForbiddenError();
            const record = user.role === client_1.UserRole.ADMIN
                ? yield this.repository.findById(id)
                : yield this.repository.findByCustomerAndId(yield this.customerId(user.id), id);
            if (!record)
                throw new customErrors_1.ObjectNotFoundError("Refund");
            return toDto(record);
        });
    }
}
exports.RefundService = RefundService;
