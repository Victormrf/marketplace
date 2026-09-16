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
exports.SellerOrderRepository = void 0;
const db_1 = __importDefault(require("../config/db"));
const itemSelect = { id: true, productId: true, quantity: true, unitPriceInCents: true, lineTotalInCents: true, currency: true, productNameSnapshot: true, productReferenceSnapshot: true, sellerNameSnapshot: true };
const historySelect = { id: true, fromStatus: true, toStatus: true, reason: true, createdAt: true };
const detailSelect = { id: true, orderId: true, sellerId: true, status: true, subtotalInCents: true, shippingInCents: true, taxInCents: true, discountInCents: true, totalInCents: true, currency: true, createdAt: true, updatedAt: true, confirmedAt: true, completedAt: true, cancelledAt: true, order: { select: { status: true } }, items: { select: itemSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }, statusHistory: { select: historySelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] } };
const summarySelect = { id: true, orderId: true, sellerId: true, status: true, totalInCents: true, currency: true, createdAt: true };
function whereFor(sellerId, filters) { return Object.assign(Object.assign({ sellerId }, (filters.status ? { status: filters.status } : {})), (filters.createdFrom || filters.createdTo ? { createdAt: Object.assign(Object.assign({}, (filters.createdFrom ? { gte: filters.createdFrom } : {})), (filters.createdTo ? { lte: filters.createdTo } : {})) } : {})); }
class SellerOrderRepository {
    countBySeller(sellerId, filters) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.sellerOrder.count({ where: whereFor(sellerId, filters) }); });
    }
    findBySeller(sellerId, filters, skip, take) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.sellerOrder.findMany({ where: whereFor(sellerId, filters), select: summarySelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take }); });
    }
    findBySellerAndId(sellerId, sellerOrderId) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.sellerOrder.findFirst({ where: { id: sellerOrderId, sellerId }, select: detailSelect }); });
    }
    findById(sellerOrderId) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.sellerOrder.findUnique({ where: { id: sellerOrderId }, select: detailSelect }); });
    }
    transition(sellerOrderId, sellerId, fromStatus, toStatus, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const current = yield tx.sellerOrder.findUnique({ where: { id: sellerOrderId }, select: { status: true, order: { select: { status: true } } } });
                if (!current || current.status !== fromStatus)
                    return null;
                if (current.order.status === "PENDING_PAYMENT" && toStatus !== "CANCELLED")
                    return null;
                const updated = yield tx.sellerOrder.updateMany({ where: Object.assign(Object.assign({ id: sellerOrderId }, (sellerId ? { sellerId } : {})), { status: fromStatus }), data: Object.assign(Object.assign(Object.assign({ status: toStatus }, (toStatus === "CONFIRMED" ? { confirmedAt: new Date() } : {})), (toStatus === "DELIVERED" ? { completedAt: new Date() } : {})), (toStatus === "CANCELLED" ? { cancelledAt: new Date() } : {})) });
                if (updated.count !== 1)
                    return null;
                yield tx.sellerOrderStatusHistory.create({ data: { sellerOrderId, fromStatus, toStatus, reason } });
                return tx.sellerOrder.findUnique({ where: { id: sellerOrderId }, select: detailSelect });
            }));
        });
    }
}
exports.SellerOrderRepository = SellerOrderRepository;
