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
exports.DeliveryRepository = void 0;
const db_1 = __importDefault(require("../config/db"));
const customErrors_1 = require("../utils/customErrors");
const deliverySelect = {
    id: true,
    sellerOrderId: true,
    trackingCode: true,
    carrier: true,
    status: true,
    estimatedDelivery: true,
    deliveredAt: true,
    createdAt: true,
    updatedAt: true,
};
const historySelect = {
    id: true,
    deliveryId: true,
    fromStatus: true,
    toStatus: true,
    changedAt: true,
    reason: true,
};
const deliveryJobSelect = Object.assign(Object.assign({}, deliverySelect), { statusHistory: {
        orderBy: [{ changedAt: "desc" }, { id: "desc" }],
        take: 1,
        select: historySelect,
    } });
function accessWhere(access) {
    if (access.admin)
        return {};
    return {
        sellerOrder: Object.assign(Object.assign({}, (access.sellerId ? { sellerId: access.sellerId } : {})), (access.customerId
            ? { order: { customerId: access.customerId } }
            : {})),
    };
}
class DeliveryRepository {
    constructor(testHooks = {}) {
        this.testHooks = testHooks;
    }
    create(sellerOrderId, sellerId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                const rows = yield tx.$queryRaw `SELECT "id", "sellerId", "status" FROM "seller_order" WHERE "id" = ${sellerOrderId} FOR UPDATE`;
                const sellerOrder = rows[0];
                if (!sellerOrder ||
                    (sellerId !== null && sellerOrder.sellerId !== sellerId)) {
                    throw new customErrors_1.ObjectNotFoundError("SellerOrder");
                }
                if (["PENDING", "CANCELLED", "RETURNED", "DELIVERED"].includes(sellerOrder.status)) {
                    throw new customErrors_1.ConflictError("SellerOrder is not compatible with delivery creation");
                }
                const existing = yield tx.delivery.findUnique({
                    where: { sellerOrderId },
                    select: { id: true },
                });
                if (existing)
                    throw new customErrors_1.ConflictError("SellerOrder already has a delivery");
                const delivery = yield tx.delivery.create({
                    data: {
                        sellerOrderId,
                        trackingCode: (_a = input.trackingCode) !== null && _a !== void 0 ? _a : null,
                        carrier: (_b = input.carrier) !== null && _b !== void 0 ? _b : null,
                        estimatedDelivery: (_c = input.estimatedDelivery) !== null && _c !== void 0 ? _c : null,
                        status: "SEPARATED",
                    },
                    select: deliverySelect,
                });
                yield tx.deliveryStatusHistory.create({
                    data: {
                        deliveryId: delivery.id,
                        fromStatus: null,
                        toStatus: "SEPARATED",
                        reason: null,
                    },
                });
                return delivery;
            }));
        });
    }
    findById(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, access = {}) {
            return db_1.default.delivery.findFirst({
                where: Object.assign({ id }, accessWhere(access)),
                select: deliverySelect,
            });
        });
    }
    findBySellerOrder(sellerOrderId, access) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.delivery.findFirst({
                where: Object.assign({ sellerOrderId }, accessWhere(access)),
                select: deliverySelect,
            });
        });
    }
    transition(id_1, input_1) {
        return __awaiter(this, arguments, void 0, function* (id, input, access = {}, expectedStatus, eligibleBefore, expectedHistoryId) {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                const identity = yield tx.delivery.findUnique({
                    where: { id },
                    select: { id: true },
                });
                if (!identity)
                    return null;
                yield tx.$queryRaw `SELECT "id" FROM "delivery" WHERE "id" = ${id} FOR UPDATE`;
                const authorized = yield tx.delivery.findFirst({
                    where: Object.assign({ id }, accessWhere(access)),
                    select: { id: true },
                });
                if (!authorized)
                    return null;
                const delivery = yield tx.delivery.findUnique({
                    where: { id },
                    select: deliverySelect,
                });
                if (!delivery)
                    return null;
                if (expectedStatus && delivery.status !== expectedStatus)
                    return null;
                if (eligibleBefore || expectedHistoryId) {
                    const latestHistory = yield tx.deliveryStatusHistory.findFirst({
                        where: { deliveryId: id },
                        orderBy: [{ changedAt: "desc" }, { id: "desc" }],
                        select: historySelect,
                    });
                    if (!latestHistory ||
                        latestHistory.toStatus !== delivery.status ||
                        (eligibleBefore && latestHistory.changedAt > eligibleBefore) ||
                        (expectedHistoryId && latestHistory.id !== expectedHistoryId)) {
                        return null;
                    }
                }
                if (delivery.status === input.status)
                    return delivery;
                const transitions = {
                    SEPARATED: ["PROCESSING", "FAILED"],
                    PROCESSING: ["SHIPPED", "FAILED"],
                    SHIPPED: ["COLLECTED", "FAILED"],
                    COLLECTED: ["ARRIVED_AT_CENTER", "FAILED"],
                    ARRIVED_AT_CENTER: ["DELIVERED", "FAILED"],
                    DELIVERED: ["RETURNED"],
                    FAILED: ["RETURNED"],
                    RETURNED: [],
                };
                if (!transitions[delivery.status].includes(input.status)) {
                    throw new customErrors_1.ConflictError("Invalid delivery transition");
                }
                const updated = yield tx.delivery.updateMany({
                    where: { id, status: delivery.status },
                    data: Object.assign({ status: input.status }, (input.status === "DELIVERED" && !delivery.deliveredAt
                        ? { deliveredAt: new Date() }
                        : {})),
                });
                if (updated.count !== 1)
                    throw new customErrors_1.ConflictError("Delivery changed concurrently");
                yield ((_b = (_a = this.testHooks).beforeHistory) === null || _b === void 0 ? void 0 : _b.call(_a));
                yield tx.deliveryStatusHistory.create({
                    data: {
                        deliveryId: id,
                        fromStatus: delivery.status,
                        toStatus: input.status,
                        reason: (_c = input.reason) !== null && _c !== void 0 ? _c : null,
                    },
                });
                return tx.delivery.findUnique({ where: { id }, select: deliverySelect });
            }));
        });
    }
    updateTracking(id_1, input_1) {
        return __awaiter(this, arguments, void 0, function* (id, input, access = {}) {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                yield tx.$queryRaw `SELECT "id" FROM "delivery" WHERE "id" = ${id} FOR UPDATE`;
                const current = yield tx.delivery.findFirst({
                    where: Object.assign({ id }, accessWhere(access)),
                    select: deliverySelect,
                });
                if (!current)
                    return null;
                if (["DELIVERED", "RETURNED", "FAILED"].includes(current.status)) {
                    throw new customErrors_1.ConflictError("Delivery tracking is not editable in this state");
                }
                return tx.delivery.update({
                    where: { id },
                    data: input,
                    select: deliverySelect,
                });
            }));
        });
    }
    listHistory(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.deliveryStatusHistory.findMany({
                where: { deliveryId: id },
                select: historySelect,
                orderBy: [{ changedAt: "desc" }, { id: "desc" }],
            });
        });
    }
    findForJob(afterId, take) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.delivery.findMany({
                where: {
                    id: afterId ? { gt: afterId } : undefined,
                    status: { notIn: ["DELIVERED", "RETURNED"] },
                },
                select: deliveryJobSelect,
                orderBy: { id: "asc" },
                take,
            });
        });
    }
}
exports.DeliveryRepository = DeliveryRepository;
