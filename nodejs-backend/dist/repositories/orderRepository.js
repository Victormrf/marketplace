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
    id: true,
    productId: true,
    quantity: true,
    unitPriceInCents: true,
    lineTotalInCents: true,
    currency: true,
    productNameSnapshot: true,
    productReferenceSnapshot: true,
    sellerNameSnapshot: true,
};
const orderHistorySelect = {
    id: true,
    fromStatus: true,
    toStatus: true,
    reason: true,
    createdAt: true,
};
const sellerHistorySelect = {
    id: true,
    fromStatus: true,
    toStatus: true,
    reason: true,
    createdAt: true,
};
const sellerDetailSelect = {
    id: true,
    orderId: true,
    sellerId: true,
    status: true,
    subtotalInCents: true,
    shippingInCents: true,
    taxInCents: true,
    discountInCents: true,
    totalInCents: true,
    currency: true,
    createdAt: true,
    updatedAt: true,
    confirmedAt: true,
    completedAt: true,
    cancelledAt: true,
    items: {
        select: itemSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    },
    statusHistory: {
        select: sellerHistorySelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    },
};
const orderSummarySelect = {
    id: true,
    status: true,
    totalInCents: true,
    currency: true,
    createdAt: true,
};
const orderDetailSelect = {
    id: true,
    customerId: true,
    status: true,
    subtotalInCents: true,
    shippingInCents: true,
    taxInCents: true,
    discountInCents: true,
    totalInCents: true,
    currency: true,
    createdAt: true,
    updatedAt: true,
    confirmedAt: true,
    completedAt: true,
    cancelledAt: true,
    address: {
        select: {
            id: true,
            sourceAddressId: true,
            recipientName: true,
            postalCode: true,
            street: true,
            number: true,
            complement: true,
            neighborhood: true,
            city: true,
            state: true,
            countryCode: true,
            phone: true,
            createdAt: true,
        },
    },
    sellerOrders: {
        select: sellerDetailSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    },
    statusHistory: {
        select: orderHistorySelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    },
};
function orderWhere(customerId, filters) {
    return Object.assign(Object.assign({ customerId }, (filters.status ? { status: filters.status } : {})), (filters.createdFrom || filters.createdTo
        ? {
            createdAt: Object.assign(Object.assign({}, (filters.createdFrom ? { gte: filters.createdFrom } : {})), (filters.createdTo ? { lte: filters.createdTo } : {})),
        }
        : {}));
}
class OrderRepository {
    constructor(testHooks = {}) {
        this.testHooks = testHooks;
    }
    countByCustomer(customerId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order.count({ where: orderWhere(customerId, filters) });
        });
    }
    findByCustomer(customerId, filters, skip, take) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order.findMany({
                where: orderWhere(customerId, filters),
                select: orderSummarySelect,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip,
                take,
            });
        });
    }
    findByCustomerAndId(customerId, orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order.findFirst({
                where: { id: orderId, customerId },
                select: orderDetailSelect,
            });
        });
    }
    findById(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order.findUnique({
                where: { id: orderId },
                select: orderDetailSelect,
            });
        });
    }
    transition(orderId, fromStatus, toStatus, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const current = yield tx.order.findUnique({
                    where: { id: orderId },
                    select: { status: true },
                });
                if (!current || current.status !== fromStatus)
                    return null;
                const updated = yield tx.order.updateMany({
                    where: { id: orderId, status: fromStatus },
                    data: Object.assign(Object.assign(Object.assign({ status: toStatus }, (toStatus === "CONFIRMED" ? { confirmedAt: new Date() } : {})), (toStatus === "COMPLETED" ? { completedAt: new Date() } : {})), (toStatus === "CANCELLED" ? { cancelledAt: new Date() } : {})),
                });
                if (updated.count !== 1)
                    return null;
                yield ((_b = (_a = this.testHooks).beforeOrderHistory) === null || _b === void 0 ? void 0 : _b.call(_a));
                yield tx.orderStatusHistory.create({
                    data: { orderId, fromStatus, toStatus, reason },
                });
                return tx.order.findUnique({
                    where: { id: orderId },
                    select: orderDetailSelect,
                });
            }));
        });
    }
}
exports.OrderRepository = OrderRepository;
