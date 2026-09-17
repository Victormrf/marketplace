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
const client_1 = require("@prisma/client");
const paymentAttemptRepository_1 = require("../repositories/paymentAttemptRepository");
const paymentProvider_1 = require("../providers/paymentProvider");
const customerRepository_1 = require("../repositories/customerRepository");
const customErrors_1 = require("../utils/customErrors");
function dto(record) {
    return {
        id: record.id,
        orderId: record.orderId,
        provider: record.provider,
        providerReference: record.providerReference,
        method: record.method,
        status: record.status,
        amountInCents: record.amountInCents,
        currency: record.currency,
        failureCode: record.failureCode,
        failureMessage: record.failureMessage,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        authorizedAt: record.authorizedAt,
        capturedAt: record.capturedAt,
        failedAt: record.failedAt,
        cancelledAt: record.cancelledAt,
    };
}
function page(total, current, limit) {
    return { page: current, limit, total, totalPages: Math.ceil(total / limit) };
}
function failureText(value, field) {
    if (value === undefined)
        return undefined;
    if (typeof value !== "string")
        throw new customErrors_1.ValidationError(`${field} must be a string`);
    const normalized = value.trim();
    if (normalized.length > 500)
        throw new customErrors_1.ValidationError(`${field} is too long`);
    return normalized || undefined;
}
class PaymentService {
    constructor(repository = new paymentAttemptRepository_1.PaymentAttemptRepository(), provider = new paymentProvider_1.DevPaymentProvider()) {
        this.repository = repository;
        this.provider = provider;
    }
    customerId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const profile = yield customerRepository_1.customerRepository.findByUserId(userId);
            if (!profile)
                throw new customErrors_1.ForbiddenError("Only customers can access payments");
            return profile.id;
        });
    }
    createAttempt(user, orderId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            if (user.role !== client_1.UserRole.CUSTOMER)
                throw new customErrors_1.ForbiddenError();
            const customerId = yield this.customerId(user.id);
            if (!Object.values(client_1.PaymentMethod).includes(input.method))
                throw new customErrors_1.ValidationError("Invalid payment method");
            const local = yield this.repository.createLocalForCustomer(customerId, orderId, input);
            return this.provisionAttempt(local.id);
        });
    }
    /** Reconciles the same locally-created attempt; it is intentionally not an HTTP operation. */
    provisionAttempt(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const local = yield this.repository.findById(id);
            if (!local)
                throw new customErrors_1.ObjectNotFoundError("PaymentAttempt");
            if (local.status !== client_1.PaymentAttemptStatus.CREATED)
                throw new customErrors_1.ConflictError("Only CREATED attempts can be provisioned");
            let external;
            try {
                external = yield this.provider.createAttempt({
                    paymentAttemptId: local.id,
                    orderId: local.orderId,
                    method: local.method,
                    amountInCents: local.amountInCents,
                });
            }
            catch (error) {
                if (error instanceof paymentProvider_1.PaymentProviderDefinitiveError)
                    yield this.repository
                        .failProvisioning(local.id, error.failureCode, "Payment provider rejected the payment")
                        .catch(() => undefined);
                throw error;
            }
            return dto(yield this.repository.setProviderReference(local.id, external.providerReference));
        });
    }
    listAttempts(user, orderId, filters, current, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const customerId = user.role === client_1.UserRole.CUSTOMER ? yield this.customerId(user.id) : null;
            if (user.role !== client_1.UserRole.CUSTOMER && user.role !== client_1.UserRole.ADMIN)
                throw new customErrors_1.ForbiddenError();
            const [total, records] = customerId
                ? yield Promise.all([
                    this.repository.countForCustomer(customerId, orderId, filters),
                    this.repository.findForCustomer(customerId, orderId, filters, (current - 1) * limit, limit),
                ])
                : yield Promise.all([
                    this.repository.countAll(orderId, filters),
                    this.repository.findAll(orderId, filters, (current - 1) * limit, limit),
                ]);
            return { data: records.map(dto), pagination: page(total, current, limit) };
        });
    }
    getAttempt(user, id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (user.role === client_1.UserRole.SELLER)
                throw new customErrors_1.ForbiddenError();
            const record = user.role === client_1.UserRole.ADMIN
                ? yield this.repository.findById(id)
                : yield this.repository.findByCustomerAndId(yield this.customerId(user.id), id);
            if (!record)
                throw new customErrors_1.ObjectNotFoundError("PaymentAttempt");
            return dto(record);
        });
    }
    startProcessing(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return dto(yield this.requireTransition(id, client_1.PaymentAttemptStatus.PROCESSING));
        });
    }
    authorize(id, providerReference) {
        return __awaiter(this, void 0, void 0, function* () {
            const record = yield this.repository.findById(id);
            if (!record || record.providerReference !== providerReference)
                throw new customErrors_1.ObjectNotFoundError("PaymentAttempt");
            return dto(yield this.requireTransition(id, client_1.PaymentAttemptStatus.AUTHORIZED));
        });
    }
    capture(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return dto(yield this.requireCapture(id));
        });
    }
    fail(id, failure) {
        return __awaiter(this, void 0, void 0, function* () {
            return dto(yield this.requireTransition(id, client_1.PaymentAttemptStatus.FAILED, failureText(failure.failureCode, "failureCode"), failureText(failure.failureMessage, "failureMessage")));
        });
    }
    cancel(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return dto(yield this.requireTransition(id, client_1.PaymentAttemptStatus.CANCELLED));
        });
    }
    requireTransition(id, target, code, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.repository.transition(id, target, code, message);
            if (!result)
                throw new customErrors_1.ObjectNotFoundError("PaymentAttempt");
            return result;
        });
    }
    requireCapture(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.repository.capture(id);
            if (!result)
                throw new customErrors_1.ObjectNotFoundError("PaymentAttempt");
            return result;
        });
    }
}
exports.PaymentService = PaymentService;
