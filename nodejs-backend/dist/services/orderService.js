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
exports.OrderService = void 0;
const client_1 = require("@prisma/client");
const customerRepository_1 = require("../repositories/customerRepository");
const sellerRepository_1 = require("../repositories/sellerRepository");
const orderRepository_1 = require("../repositories/orderRepository");
const sellerOrderRepository_1 = require("../repositories/sellerOrderRepository");
const customErrors_1 = require("../utils/customErrors");
// Only payment may confirm an order in this stage. Aggregate completion and cancellation
// require reservation/payment coordination and remain disabled until their later stages.
const internalOrderTransitions = { PENDING_PAYMENT: [client_1.OrderStatus.CONFIRMED], CONFIRMED: [], PARTIALLY_COMPLETED: [], COMPLETED: [], CANCELLED: [] };
const publicSellerTransitions = { PENDING: [client_1.SellerOrderStatus.CONFIRMED], CONFIRMED: [client_1.SellerOrderStatus.PROCESSING], PROCESSING: [], SHIPPED: [], DELIVERED: [], CANCELLED: [], RETURNED: [] };
function normalizeReason(reason) { if (reason === undefined)
    return undefined; if (typeof reason !== "string")
    throw new customErrors_1.ValidationError("Reason must be a string"); const normalized = reason.trim(); if (normalized.length > 500)
    throw new customErrors_1.ValidationError("Reason is too long"); return normalized || undefined; }
function page(total, current, limit) { return { page: current, limit, total, totalPages: Math.ceil(total / limit) }; }
function itemDto(item) { return { id: item.id, productId: item.productId, quantity: item.quantity, unitPriceInCents: item.unitPriceInCents, lineTotalInCents: item.lineTotalInCents, currency: item.currency, productNameSnapshot: item.productNameSnapshot, productReferenceSnapshot: item.productReferenceSnapshot, sellerNameSnapshot: item.sellerNameSnapshot }; }
function sellerHistoryDto(h) { return { id: h.id, fromStatus: h.fromStatus, toStatus: h.toStatus, reason: h.reason, createdAt: h.createdAt }; }
function sellerDetailDto(s) { return { id: s.id, orderId: s.orderId, sellerId: s.sellerId, status: s.status, subtotalInCents: s.subtotalInCents, shippingInCents: s.shippingInCents, taxInCents: s.taxInCents, discountInCents: s.discountInCents, totalInCents: s.totalInCents, currency: s.currency, createdAt: s.createdAt, updatedAt: s.updatedAt, confirmedAt: s.confirmedAt, completedAt: s.completedAt, cancelledAt: s.cancelledAt, items: s.items.map(itemDto), statusHistory: s.statusHistory.map(sellerHistoryDto) }; }
function sellerSummaryDto(s) { return { id: s.id, orderId: s.orderId, sellerId: s.sellerId, status: s.status, totalInCents: s.totalInCents, currency: s.currency, createdAt: s.createdAt }; }
function orderHistoryDto(h) { return { id: h.id, fromStatus: h.fromStatus, toStatus: h.toStatus, reason: h.reason, createdAt: h.createdAt }; }
function orderDetailDto(o) { return { id: o.id, customerId: o.customerId, status: o.status, subtotalInCents: o.subtotalInCents, shippingInCents: o.shippingInCents, taxInCents: o.taxInCents, discountInCents: o.discountInCents, totalInCents: o.totalInCents, currency: o.currency, createdAt: o.createdAt, updatedAt: o.updatedAt, confirmedAt: o.confirmedAt, completedAt: o.completedAt, cancelledAt: o.cancelledAt, address: o.address, sellerOrders: o.sellerOrders.map(sellerDetailDto), statusHistory: o.statusHistory.map(orderHistoryDto) }; }
class OrderService {
    constructor(orders = new orderRepository_1.OrderRepository(), sellerOrders = new sellerOrderRepository_1.SellerOrderRepository()) {
        this.orders = orders;
        this.sellerOrders = sellerOrders;
    }
    customerIdFor(userId) {
        return __awaiter(this, void 0, void 0, function* () { const profile = yield customerRepository_1.customerRepository.findByUserId(userId); if (!profile)
            throw new customErrors_1.ForbiddenError("Only customers can access customer orders"); return profile.id; });
    }
    sellerIdFor(userId) {
        return __awaiter(this, void 0, void 0, function* () { const seller = yield sellerRepository_1.sellerRepository.findByUserId(userId); if (!seller || !seller.isActive)
            throw new customErrors_1.ForbiddenError("Only active sellers can access seller orders"); return seller.id; });
    }
    listCustomerOrders(userId, filters, current, limit) {
        return __awaiter(this, void 0, void 0, function* () { const id = yield this.customerIdFor(userId); const [total, records] = yield Promise.all([this.orders.countByCustomer(id, filters), this.orders.findByCustomer(id, filters, (current - 1) * limit, limit)]); return { data: records.map((r) => ({ id: r.id, status: r.status, totalInCents: r.totalInCents, currency: r.currency, createdAt: r.createdAt })), pagination: page(total, current, limit) }; });
    }
    getCustomerOrder(userId, orderId) {
        return __awaiter(this, void 0, void 0, function* () { const id = yield this.customerIdFor(userId); const record = yield this.orders.findByCustomerAndId(id, orderId); if (!record)
            throw new customErrors_1.ObjectNotFoundError("Order"); return orderDetailDto(record); });
    }
    listSellerOrders(userId, filters, current, limit) {
        return __awaiter(this, void 0, void 0, function* () { const id = yield this.sellerIdFor(userId); const [total, records] = yield Promise.all([this.sellerOrders.countBySeller(id, filters), this.sellerOrders.findBySeller(id, filters, (current - 1) * limit, limit)]); return { data: records.map(sellerSummaryDto), pagination: page(total, current, limit) }; });
    }
    getSellerOrder(userId, sellerOrderId) {
        return __awaiter(this, void 0, void 0, function* () { const id = yield this.sellerIdFor(userId); const record = yield this.sellerOrders.findBySellerAndId(id, sellerOrderId); if (!record)
            throw new customErrors_1.ObjectNotFoundError("SellerOrder"); return sellerDetailDto(record); });
    }
    /** Internal payment/order orchestration hook. It is intentionally not exposed by an HTTP route. */
    transitionOrderInternally(orderId, input) {
        return __awaiter(this, void 0, void 0, function* () { const record = yield this.orders.findById(orderId); if (!record)
            throw new customErrors_1.ObjectNotFoundError("Order"); const target = input.status; const reason = normalizeReason(input.reason); if (record.status === target)
            return orderDetailDto(record); if (!internalOrderTransitions[record.status].includes(target))
            throw new customErrors_1.ConflictError("Invalid order status transition"); const updated = yield this.orders.transition(orderId, record.status, target, reason); if (!updated)
            throw new customErrors_1.ConflictError("Order status changed concurrently"); return orderDetailDto(updated); });
    }
    transitionSellerOrder(user, sellerOrderId, input) {
        return __awaiter(this, void 0, void 0, function* () { const sellerId = user.role === client_1.UserRole.SELLER ? yield this.sellerIdFor(user.id) : null; if (user.role !== client_1.UserRole.SELLER && user.role !== client_1.UserRole.ADMIN)
            throw new customErrors_1.ForbiddenError(); const record = sellerId ? yield this.sellerOrders.findBySellerAndId(sellerId, sellerOrderId) : yield this.sellerOrders.findById(sellerOrderId); if (!record)
            throw new customErrors_1.ObjectNotFoundError("SellerOrder"); const target = input.status; const reason = normalizeReason(input.reason); if (!Object.values(client_1.SellerOrderStatus).includes(target))
            throw new customErrors_1.ValidationError("Invalid seller order status"); if (record.status === target)
            return sellerDetailDto(record); if (!publicSellerTransitions[record.status].includes(target))
            throw new customErrors_1.ConflictError("Seller order transition is not enabled yet"); const updated = yield this.sellerOrders.transition(sellerOrderId, sellerId, record.status, target, reason); if (!updated)
            throw new customErrors_1.ConflictError("Seller order status changed concurrently or parent order is not CONFIRMED"); return sellerDetailDto(updated); });
    }
}
exports.OrderService = OrderService;
