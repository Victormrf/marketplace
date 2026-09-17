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
exports.DeliveryService = void 0;
const client_1 = require("@prisma/client");
const customerRepository_1 = require("../repositories/customerRepository");
const deliveryRepository_1 = require("../repositories/deliveryRepository");
const sellerRepository_1 = require("../repositories/sellerRepository");
const customErrors_1 = require("../utils/customErrors");
function toDto(record) {
    return {
        id: record.id,
        sellerOrderId: record.sellerOrderId,
        trackingCode: record.trackingCode,
        carrier: record.carrier,
        status: record.status,
        estimatedDelivery: record.estimatedDelivery,
        deliveredAt: record.deliveredAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}
function normalizeText(value, field, required = false) {
    if (value === undefined || value === null) {
        if (required)
            throw new customErrors_1.ValidationError(`${field} is required`);
        return null;
    }
    if (typeof value !== "string")
        throw new customErrors_1.ValidationError(`${field} must be a string`);
    const normalized = value.trim();
    if (required && !normalized)
        throw new customErrors_1.ValidationError(`${field} is required`);
    if (normalized.length > 255)
        throw new customErrors_1.ValidationError(`${field} is too long`);
    return normalized || null;
}
function normalizeReason(value) {
    return normalizeText(value, "reason");
}
function normalizeTracking(input, requireField = true) {
    const result = {};
    if (input.trackingCode !== undefined)
        result.trackingCode = normalizeText(input.trackingCode, "trackingCode", true);
    if (input.carrier !== undefined)
        result.carrier = normalizeText(input.carrier, "carrier", true);
    if (input.estimatedDelivery !== undefined) {
        if (input.estimatedDelivery !== null &&
            Number.isNaN(input.estimatedDelivery.getTime()))
            throw new customErrors_1.ValidationError("estimatedDelivery is invalid");
        result.estimatedDelivery = input.estimatedDelivery;
    }
    if (requireField && !Object.keys(result).length)
        throw new customErrors_1.ValidationError("No fields to update");
    return result;
}
class DeliveryService {
    constructor(repository = new deliveryRepository_1.DeliveryRepository()) {
        this.repository = repository;
    }
    readAccess(user) {
        return __awaiter(this, void 0, void 0, function* () {
            if (user.role === client_1.UserRole.ADMIN)
                return { admin: true };
            if (user.role === client_1.UserRole.CUSTOMER) {
                const customer = yield customerRepository_1.customerRepository.findByUserId(user.id);
                if (!customer)
                    throw new customErrors_1.ForbiddenError();
                return { customerId: customer.id };
            }
            if (user.role === client_1.UserRole.SELLER) {
                const seller = yield sellerRepository_1.sellerRepository.findByUserId(user.id);
                if (!seller || !seller.isActive)
                    throw new customErrors_1.ForbiddenError();
                return { sellerId: seller.id };
            }
            throw new customErrors_1.ForbiddenError();
        });
    }
    writeAccess(user) {
        return __awaiter(this, void 0, void 0, function* () {
            if (user.role === client_1.UserRole.ADMIN)
                return { admin: true };
            if (user.role !== client_1.UserRole.SELLER)
                throw new customErrors_1.ForbiddenError();
            const seller = yield sellerRepository_1.sellerRepository.findByUserId(user.id);
            if (!seller || !seller.isActive)
                throw new customErrors_1.ForbiddenError();
            return { sellerId: seller.id };
        });
    }
    createDelivery(user, sellerOrderId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const access = yield this.writeAccess(user);
            if (!access.admin && !access.sellerId)
                throw new customErrors_1.ForbiddenError();
            return toDto(yield this.repository.create(sellerOrderId, (_a = access.sellerId) !== null && _a !== void 0 ? _a : null, normalizeTracking(input, false)));
        });
    }
    getBySellerOrder(user, sellerOrderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const delivery = yield this.repository.findBySellerOrder(sellerOrderId, yield this.readAccess(user));
            if (!delivery)
                throw new customErrors_1.ObjectNotFoundError("Delivery");
            return toDto(delivery);
        });
    }
    get(user, id) {
        return __awaiter(this, void 0, void 0, function* () {
            const delivery = yield this.repository.findById(id, yield this.readAccess(user));
            if (!delivery)
                throw new customErrors_1.ObjectNotFoundError("Delivery");
            return toDto(delivery);
        });
    }
    history(user, id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.get(user, id);
            return (yield this.repository.listHistory(id)).map((record) => ({
                id: record.id,
                deliveryId: record.deliveryId,
                fromStatus: record.fromStatus,
                toStatus: record.toStatus,
                changedAt: record.changedAt,
                reason: record.reason,
            }));
        });
    }
    transition(user, id, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const access = yield this.writeAccess(user);
            const current = yield this.repository.findById(id, access);
            if (!current)
                throw new customErrors_1.ObjectNotFoundError("Delivery");
            const updated = yield this.repository.transition(id, { status: input.status, reason: normalizeReason(input.reason) }, access);
            if (!updated)
                throw new customErrors_1.ObjectNotFoundError("Delivery");
            return toDto(updated);
        });
    }
    updateTracking(user, id, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const access = yield this.writeAccess(user);
            if (!(yield this.repository.findById(id, access)))
                throw new customErrors_1.ObjectNotFoundError("Delivery");
            const updated = yield this.repository.updateTracking(id, normalizeTracking(input), access);
            if (!updated)
                throw new customErrors_1.ObjectNotFoundError("Delivery");
            return toDto(updated);
        });
    }
    advanceForJob(id, expectedStatus, eligibleBefore, expectedHistoryId) {
        return __awaiter(this, void 0, void 0, function* () {
            const delivery = yield this.repository.findById(id, { admin: true });
            if (!delivery || delivery.status !== expectedStatus)
                return null;
            const next = {
                SEPARATED: "PROCESSING",
                PROCESSING: "SHIPPED",
                SHIPPED: "COLLECTED",
                COLLECTED: "ARRIVED_AT_CENTER",
                ARRIVED_AT_CENTER: "DELIVERED",
            };
            const nextStatus = next[delivery.status];
            if (!nextStatus)
                return toDto(delivery);
            const updated = yield this.repository.transition(id, { status: nextStatus, reason: "Scheduled delivery progression" }, { admin: true }, expectedStatus, eligibleBefore, expectedHistoryId);
            return updated ? toDto(updated) : null;
        });
    }
}
exports.DeliveryService = DeliveryService;
