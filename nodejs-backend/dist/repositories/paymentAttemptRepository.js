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
exports.PaymentAttemptRepository = void 0;
const db_1 = __importDefault(require("../config/db"));
const customErrors_1 = require("../utils/customErrors");
const paymentSelect = { id: true, orderId: true, provider: true, providerReference: true, method: true, status: true, amountInCents: true, currency: true, failureCode: true, failureMessage: true, createdAt: true, updatedAt: true, authorizedAt: true, capturedAt: true, failedAt: true, cancelledAt: true };
function whereFor(filters) { return Object.assign(Object.assign(Object.assign({}, (filters.status ? { status: filters.status } : {})), (filters.method ? { method: filters.method } : {})), (filters.createdFrom || filters.createdTo ? { createdAt: Object.assign(Object.assign({}, (filters.createdFrom ? { gte: filters.createdFrom } : {})), (filters.createdTo ? { lte: filters.createdTo } : {})) } : {})); }
class PaymentAttemptRepository {
    constructor(testHooks = {}) {
        this.testHooks = testHooks;
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.paymentAttempt.findUnique({ where: { id }, select: paymentSelect }); });
    }
    findByCustomerAndId(customerId, id) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.paymentAttempt.findFirst({ where: { id, order: { customerId } }, select: Object.assign(Object.assign({}, paymentSelect), { order: { select: { customerId: true, totalInCents: true, currency: true, status: true } } }) }); });
    }
    countForCustomer(customerId, orderId, filters) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.paymentAttempt.count({ where: Object.assign(Object.assign({}, whereFor(filters)), { order: { customerId, id: orderId } }) }); });
    }
    findForCustomer(customerId, orderId, filters, skip, take) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.paymentAttempt.findMany({ where: Object.assign(Object.assign({}, whereFor(filters)), { order: { customerId, id: orderId } }), select: paymentSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take }); });
    }
    countAll(orderId, filters) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.paymentAttempt.count({ where: Object.assign(Object.assign({}, whereFor(filters)), { orderId }) }); });
    }
    findAll(orderId, filters, skip, take) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.paymentAttempt.findMany({ where: Object.assign(Object.assign({}, whereFor(filters)), { orderId }), select: paymentSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take }); });
    }
    createLocalForCustomer(customerId, orderId, input) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () { const rows = yield tx.$queryRaw `SELECT "id", "status", "totalInCents", "currency" FROM "order" WHERE "id" = ${orderId} AND "customerId" = ${customerId} FOR UPDATE`; const order = rows[0]; if (!order)
            throw new customErrors_1.ConflictError("Order is not owned by the customer"); if (order.status !== "PENDING_PAYMENT")
            throw new customErrors_1.ConflictError("Payment attempts require a pending payment order"); const existing = yield tx.paymentAttempt.findFirst({ where: { orderId, status: { in: ["CREATED", "PROCESSING", "AUTHORIZED", "CAPTURED"] } }, select: { id: true, status: true } }); if (existing)
            throw new customErrors_1.ConflictError("Order already has an active or captured payment attempt"); return tx.paymentAttempt.create({ data: { orderId, provider: "DEV_SIMULATOR", providerReference: null, method: input.method, amountInCents: order.totalInCents, currency: order.currency }, select: paymentSelect }); })); });
    }
    setProviderReference(id, providerReference) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () { const current = yield tx.paymentAttempt.findUnique({ where: { id }, select: paymentSelect }); if (!current)
            throw new customErrors_1.ConflictError("Payment attempt not found"); if (current.providerReference === providerReference)
            return current; if (current.providerReference !== null)
            throw new customErrors_1.ConflictError("Payment attempt already has another provider reference"); const result = yield tx.paymentAttempt.updateMany({ where: { id, providerReference: null }, data: { providerReference } }); if (result.count !== 1)
            throw new customErrors_1.ConflictError("Payment attempt reference changed concurrently"); return tx.paymentAttempt.findUniqueOrThrow({ where: { id }, select: paymentSelect }); })); });
    }
    failProvisioning(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, failureCode = "PROVIDER_ERROR", failureMessage = "Payment provider unavailable") { return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () { const result = yield tx.paymentAttempt.updateMany({ where: { id, status: "CREATED" }, data: { status: "FAILED", failedAt: new Date(), failureCode, failureMessage } }); if (result.count !== 1)
            return tx.paymentAttempt.findUnique({ where: { id }, select: paymentSelect }); return tx.paymentAttempt.findUnique({ where: { id }, select: paymentSelect }); })); });
    }
    transition(id, target, failureCode, failureMessage) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () { var _a, _b, _c; const identity = yield tx.paymentAttempt.findUnique({ where: { id }, select: { orderId: true } }); if (!identity)
            return null; yield tx.$queryRaw `SELECT "id" FROM "order" WHERE "id" = ${identity.orderId} FOR UPDATE`; const attempt = yield tx.paymentAttempt.findUnique({ where: { id }, select: paymentSelect }); if (!attempt)
            return null; if (attempt.status === target)
            return attempt; const allowed = { CREATED: ["PROCESSING", "CANCELLED"], PROCESSING: ["AUTHORIZED", "FAILED", "CANCELLED"], AUTHORIZED: ["CAPTURED", "FAILED", "CANCELLED"], CAPTURED: [], FAILED: [], CANCELLED: [] }; if (!allowed[attempt.status].includes(target))
            throw new customErrors_1.ConflictError("Invalid payment attempt transition"); const data = { status: target }; if (target === "AUTHORIZED")
            data.authorizedAt = (_a = attempt.authorizedAt) !== null && _a !== void 0 ? _a : new Date(); if (target === "FAILED") {
            data.failedAt = (_b = attempt.failedAt) !== null && _b !== void 0 ? _b : new Date();
            data.failureCode = failureCode !== null && failureCode !== void 0 ? failureCode : null;
            data.failureMessage = failureMessage !== null && failureMessage !== void 0 ? failureMessage : null;
        } if (target === "CANCELLED")
            data.cancelledAt = (_c = attempt.cancelledAt) !== null && _c !== void 0 ? _c : new Date(); const result = yield tx.paymentAttempt.updateMany({ where: { id, status: attempt.status }, data }); if (result.count !== 1)
            throw new customErrors_1.ConflictError("Payment attempt changed concurrently"); return tx.paymentAttempt.findUnique({ where: { id }, select: paymentSelect }); })); });
    }
    capture(id) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () { var _a, _b, _c; const identity = yield tx.paymentAttempt.findUnique({ where: { id }, select: { orderId: true } }); if (!identity)
            return null; yield tx.$queryRaw `SELECT "id" FROM "order" WHERE "id" = ${identity.orderId} FOR UPDATE`; const attempt = yield tx.paymentAttempt.findUnique({ where: { id }, select: paymentSelect }); if (!attempt)
            return null; if (attempt.status === "CAPTURED")
            return attempt; if (attempt.status !== "AUTHORIZED")
            throw new customErrors_1.ConflictError("Only authorized attempts can be captured"); const order = yield tx.order.findUnique({ where: { id: attempt.orderId }, select: { status: true, totalInCents: true } }); if (!order || order.status !== "PENDING_PAYMENT")
            throw new customErrors_1.ConflictError("Order is not capturable"); if (attempt.amountInCents !== order.totalInCents)
            throw new customErrors_1.ConflictError("Payment attempt amount does not match order total"); const otherCaptured = yield tx.paymentAttempt.count({ where: { orderId: attempt.orderId, status: "CAPTURED", id: { not: id } } }); if (otherCaptured > 0)
            throw new customErrors_1.ConflictError("Order already has a captured payment attempt"); const updated = yield tx.paymentAttempt.updateMany({ where: { id, status: "AUTHORIZED", amountInCents: order.totalInCents }, data: { status: "CAPTURED", capturedAt: (_a = attempt.capturedAt) !== null && _a !== void 0 ? _a : new Date() } }); if (updated.count !== 1)
            throw new customErrors_1.ConflictError("Payment attempt changed concurrently"); yield ((_c = (_b = this.testHooks).beforeOrderConfirmation) === null || _c === void 0 ? void 0 : _c.call(_b)); const orderUpdated = yield tx.order.updateMany({ where: { id: attempt.orderId, status: "PENDING_PAYMENT" }, data: { status: "CONFIRMED", confirmedAt: new Date() } }); if (orderUpdated.count !== 1)
            throw new customErrors_1.ConflictError("Order changed concurrently"); yield tx.orderStatusHistory.create({ data: { orderId: attempt.orderId, fromStatus: "PENDING_PAYMENT", toStatus: "CONFIRMED", reason: "Payment captured in full" } }); return tx.paymentAttempt.findUnique({ where: { id }, select: paymentSelect }); })); });
    }
}
exports.PaymentAttemptRepository = PaymentAttemptRepository;
