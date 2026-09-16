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
exports.OrderRepository = void 0;
const db_1 = __importDefault(require("../config/db"));
const itemSelect = {
    id: true, productId: true, quantity: true, unitPriceInCents: true,
    lineTotalInCents: true, currency: true, productNameSnapshot: true,
    productReferenceSnapshot: true, sellerNameSnapshot: true,
};
const orderHistorySelect = {
    id: true, fromStatus: true, toStatus: true, reason: true, createdAt: true,
};
const sellerHistorySelect = {
    id: true, fromStatus: true, toStatus: true, reason: true, createdAt: true,
};
const sellerDetailSelect = {
    id: true, orderId: true, sellerId: true, status: true,
    subtotalInCents: true, shippingInCents: true, taxInCents: true,
    discountInCents: true, totalInCents: true, currency: true,
    createdAt: true, updatedAt: true, confirmedAt: true, completedAt: true,
    cancelledAt: true, items: { select: itemSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
    statusHistory: { select: sellerHistorySelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
};
const orderSummarySelect = {
    id: true, status: true, totalInCents: true, currency: true, createdAt: true,
};
const orderDetailSelect = {
    id: true, customerId: true, status: true, subtotalInCents: true,
    shippingInCents: true, taxInCents: true, discountInCents: true,
    totalInCents: true, currency: true, createdAt: true, updatedAt: true,
    confirmedAt: true, completedAt: true, cancelledAt: true,
    address: { select: { id: true, sourceAddressId: true, recipientName: true, postalCode: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true, countryCode: true, phone: true, createdAt: true } },
    sellerOrders: { select: sellerDetailSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
    statusHistory: { select: orderHistorySelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
};
function orderWhere(customerId, filters) {
    return Object.assign(Object.assign({ customerId }, (filters.status ? { status: filters.status } : {})), (filters.createdFrom || filters.createdTo ? { createdAt: Object.assign(Object.assign({}, (filters.createdFrom ? { gte: filters.createdFrom } : {})), (filters.createdTo ? { lte: filters.createdTo } : {})) } : {}));
}
class OrderRepository {
    countByCustomer(customerId, filters) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.order.count({ where: orderWhere(customerId, filters) }); });
    }
    findByCustomer(customerId, filters, skip, take) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order.findMany({ where: orderWhere(customerId, filters), select: orderSummarySelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take });
        });
    }
    findByCustomerAndId(customerId, orderId) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.order.findFirst({ where: { id: orderId, customerId }, select: orderDetailSelect }); });
    }
    findById(orderId) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.order.findUnique({ where: { id: orderId }, select: orderDetailSelect }); });
    }
    getCompletedOrderItemsBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.orderItem.findMany({ where: { sellerOrder: { sellerId, status: "DELIVERED" } }, select: { quantity: true, unitPriceInCents: true } }); });
    }
    getOrdersByStatus(sellerId) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.order.findMany({ where: { sellerOrders: { some: { sellerId }, }, createdAt: { gte: new Date(Date.now() - 14 * 86400000) } }, select: { status: true } }); });
    }
    getCompletedOrderItemsByCategory(sellerId) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.orderItem.findMany({ where: { sellerOrder: { sellerId, status: "DELIVERED" } }, select: { quantity: true, unitPriceInCents: true, product: { select: { category: true } } } }); });
    }
    getMonthlySalesBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.order.findMany({ where: { sellerOrders: { some: { sellerId, status: "DELIVERED" } }, createdAt: { gte: new Date(new Date().setMonth(new Date().getMonth() - 5)) } }, select: { totalInCents: true, createdAt: true } }); });
    }
    getDailySalesBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.order.findMany({ where: { sellerOrders: { some: { sellerId, status: "DELIVERED" } }, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }, select: { totalInCents: true, createdAt: true } }); });
    }
    getOrdersBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.sellerOrder.findMany({ where: { sellerId }, select: { id: true, orderId: true, status: true, totalInCents: true, createdAt: true } }); });
    }
    getBestSellingProductsBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () { return db_1.default.orderItem.groupBy({ by: ["productId"], where: { sellerOrder: { sellerId } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }); });
    }
    getNewCustomersByMonth(sellerId) {
        return __awaiter(this, void 0, void 0, function* () { const result = yield db_1.default.$queryRaw `SELECT DATE_TRUNC('month', MIN(o."createdAt")) AS month, COUNT(DISTINCT o."customerId") AS new_customers FROM "order" o JOIN "seller_order" so ON so."orderId" = o."id" WHERE so."sellerId" = ${sellerId} GROUP BY o."customerId" HAVING MIN(o."createdAt") >= NOW() - INTERVAL '6 months'`; return result.map((r) => ({ month: r.month, newCustomers: Number(r.new_customers) })); });
    }
    transition(orderId, fromStatus, toStatus, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const current = yield tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
                if (!current || current.status !== fromStatus)
                    return null;
                const updated = yield tx.order.updateMany({ where: { id: orderId, status: fromStatus }, data: Object.assign(Object.assign(Object.assign({ status: toStatus }, (toStatus === "CONFIRMED" ? { confirmedAt: new Date() } : {})), (toStatus === "COMPLETED" ? { completedAt: new Date() } : {})), (toStatus === "CANCELLED" ? { cancelledAt: new Date() } : {})) });
                if (updated.count !== 1)
                    return null;
                yield tx.orderStatusHistory.create({ data: { orderId, fromStatus, toStatus, reason } });
                return tx.order.findUnique({ where: { id: orderId }, select: orderDetailSelect });
            }));
        });
    }
}
exports.OrderRepository = OrderRepository;
