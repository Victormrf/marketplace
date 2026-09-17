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
exports.RefundRepository = void 0;
const db_1 = __importDefault(require("../config/db"));
const customErrors_1 = require("../utils/customErrors");
const refundSelect = {
    id: true,
    paymentAttemptId: true,
    amountInCents: true,
    currency: true,
    reason: true,
    status: true,
    providerReference: true,
    createdAt: true,
    updatedAt: true,
    completedAt: true,
    failedAt: true,
};
function whereFor(filters) {
    return Object.assign(Object.assign({}, (filters.status ? { status: filters.status } : {})), (filters.createdFrom || filters.createdTo
        ? {
            createdAt: Object.assign(Object.assign({}, (filters.createdFrom ? { gte: filters.createdFrom } : {})), (filters.createdTo ? { lte: filters.createdTo } : {})),
        }
        : {}));
}
class RefundRepository {
    createRequested(customerId, paymentAttemptId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const rows = yield tx.$queryRaw `SELECT pa."id", pa."status", pa."amountInCents", pa."currency", o."customerId", pa."providerReference" FROM "payment_attempt" pa JOIN "order" o ON o."id" = pa."orderId" WHERE pa."id" = ${paymentAttemptId} FOR UPDATE`;
                const attempt = rows[0];
                if (!attempt ||
                    (customerId !== null && attempt.customerId !== customerId))
                    throw new customErrors_1.ObjectNotFoundError("PaymentAttempt");
                if (attempt.status !== "CAPTURED")
                    throw new customErrors_1.ConflictError("Refunds require a captured payment attempt");
                if (!attempt.providerReference)
                    throw new customErrors_1.ConflictError("Captured payment has no provider reference");
                const committed = yield tx.refund.aggregate({
                    where: {
                        paymentAttemptId,
                        status: { in: ["REQUESTED", "PROCESSING", "COMPLETED"] },
                    },
                    _sum: { amountInCents: true },
                });
                const used = (_a = committed._sum.amountInCents) !== null && _a !== void 0 ? _a : 0;
                if (input.amountInCents > attempt.amountInCents - used)
                    throw new customErrors_1.ConflictError("Refund exceeds the remaining refundable amount");
                return tx.refund.create({
                    data: {
                        paymentAttemptId,
                        amountInCents: input.amountInCents,
                        currency: attempt.currency,
                        reason: (_b = input.reason) !== null && _b !== void 0 ? _b : null,
                    },
                    select: refundSelect,
                });
            }));
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.refund.findUnique({ where: { id }, select: refundSelect });
        });
    }
    findForProvisioning(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.refund.findUnique({
                where: { id },
                select: Object.assign(Object.assign({}, refundSelect), { paymentAttempt: { select: { providerReference: true } } }),
            });
        });
    }
    findByCustomerAndId(customerId, id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.refund.findFirst({
                where: { id, paymentAttempt: { order: { customerId } } },
                select: Object.assign(Object.assign({}, refundSelect), { paymentAttempt: {
                        select: {
                            providerReference: true,
                            amountInCents: true,
                            currency: true,
                            order: { select: { customerId: true } },
                        },
                    } }),
            });
        });
    }
    count(paymentAttemptId, filters, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.refund.count({
                where: Object.assign(Object.assign(Object.assign({}, whereFor(filters)), { paymentAttemptId }), (customerId ? { paymentAttempt: { order: { customerId } } } : {})),
            });
        });
    }
    findMany(paymentAttemptId, filters, skip, take, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.refund.findMany({
                where: Object.assign(Object.assign(Object.assign({}, whereFor(filters)), { paymentAttemptId }), (customerId ? { paymentAttempt: { order: { customerId } } } : {})),
                select: refundSelect,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip,
                take,
            });
        });
    }
    transition(id, target) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const identity = yield tx.refund.findUnique({
                    where: { id },
                    select: { paymentAttemptId: true },
                });
                if (!identity)
                    return null;
                yield tx.$queryRaw `SELECT "id" FROM "payment_attempt" WHERE "id" = ${identity.paymentAttemptId} FOR UPDATE`;
                const refund = yield tx.refund.findUnique({
                    where: { id },
                    select: refundSelect,
                });
                if (!refund)
                    return null;
                if (refund.status === target)
                    return refund;
                const allowed = {
                    REQUESTED: ["PROCESSING"],
                    PROCESSING: ["COMPLETED", "DECLINED", "FAILED"],
                    COMPLETED: [],
                    DECLINED: [],
                    FAILED: [],
                };
                if (!allowed[refund.status].includes(target))
                    throw new customErrors_1.ConflictError("Invalid refund transition");
                const data = { status: target };
                if (target === "COMPLETED")
                    data.completedAt = (_a = refund.completedAt) !== null && _a !== void 0 ? _a : new Date();
                if (target === "FAILED")
                    data.failedAt = (_b = refund.failedAt) !== null && _b !== void 0 ? _b : new Date();
                const updated = yield tx.refund.updateMany({
                    where: { id, status: refund.status },
                    data,
                });
                if (updated.count !== 1)
                    throw new customErrors_1.ConflictError("Refund changed concurrently");
                return tx.refund.findUnique({ where: { id }, select: refundSelect });
            }));
        });
    }
    setProviderReference(id, providerReference) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const current = yield tx.refund.findUnique({
                    where: { id },
                    select: refundSelect,
                });
                if (!current)
                    throw new customErrors_1.ObjectNotFoundError("Refund");
                if (current.providerReference === providerReference)
                    return current;
                if (current.providerReference !== null)
                    throw new customErrors_1.ConflictError("Refund already has another provider reference");
                const result = yield tx.refund.updateMany({
                    where: { id, providerReference: null },
                    data: { providerReference },
                });
                if (result.count !== 1)
                    throw new customErrors_1.ConflictError("Refund reference changed concurrently");
                return tx.refund.findUniqueOrThrow({
                    where: { id },
                    select: refundSelect,
                });
            }));
        });
    }
}
exports.RefundRepository = RefundRepository;
