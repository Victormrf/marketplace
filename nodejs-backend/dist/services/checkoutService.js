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
exports.checkoutService = exports.CheckoutService = void 0;
exports.toCheckoutDto = toCheckoutDto;
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const checkoutRepository_1 = require("../repositories/checkoutRepository");
const customerRepository_1 = require("../repositories/customerRepository");
const userRepository_1 = require("../repositories/userRepository");
const customErrors_1 = require("../utils/customErrors");
function toCheckoutDto(record) {
    return {
        id: record.id, status: record.status, subtotalInCents: record.subtotalInCents,
        shippingInCents: record.shippingInCents, taxInCents: record.taxInCents,
        discountInCents: record.discountInCents, totalInCents: record.totalInCents,
        currency: record.currency, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
        address: record.address ? {
            id: record.address.id, sourceAddressId: record.address.sourceAddressId,
            recipientName: record.address.recipientName, postalCode: record.address.postalCode,
            street: record.address.street, number: record.address.number, complement: record.address.complement,
            neighborhood: record.address.neighborhood, city: record.address.city, state: record.address.state,
            countryCode: record.address.countryCode, phone: record.address.phone, createdAt: record.address.createdAt.toISOString(),
        } : null,
        sellerOrders: record.sellerOrders.map((sellerOrder) => ({
            id: sellerOrder.id, sellerId: sellerOrder.sellerId, status: sellerOrder.status,
            subtotalInCents: sellerOrder.subtotalInCents, shippingInCents: sellerOrder.shippingInCents,
            taxInCents: sellerOrder.taxInCents, discountInCents: sellerOrder.discountInCents,
            totalInCents: sellerOrder.totalInCents, currency: sellerOrder.currency,
            items: sellerOrder.items.map((item) => {
                var _a, _b;
                return ({
                    id: item.id, productId: item.productId, quantity: item.quantity,
                    unitPriceInCents: item.unitPriceInCents, lineTotalInCents: item.lineTotalInCents,
                    currency: item.currency, productNameSnapshot: item.productNameSnapshot,
                    productReferenceSnapshot: item.productReferenceSnapshot, sellerNameSnapshot: item.sellerNameSnapshot,
                    reservation: item.inventoryReservation ? {
                        id: item.inventoryReservation.id, status: item.inventoryReservation.status,
                        quantity: item.inventoryReservation.quantity, expiresAt: (_b = (_a = item.inventoryReservation.expiresAt) === null || _a === void 0 ? void 0 : _a.toISOString()) !== null && _b !== void 0 ? _b : null,
                    } : null,
                });
            }),
        })),
    };
}
class CheckoutService {
    constructor(repository = checkoutRepository_1.checkoutRepository) {
        this.repository = repository;
    }
    checkout(userId, input, idempotencyKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
            if (!key || key.length > 255)
                throw new customErrors_1.ValidationError("Idempotency-Key must be a non-empty string of at most 255 characters");
            const keys = Object.keys(input);
            if (keys.length !== 1 || keys[0] !== "addressId")
                throw new customErrors_1.ValidationError("Only addressId is accepted");
            if (typeof input.addressId !== "string" || input.addressId.trim() === "")
                throw new customErrors_1.ValidationError("addressId is required");
            const user = yield userRepository_1.userRepository.findById(userId);
            if (!user || !user.isActive)
                throw new customErrors_1.ObjectNotFoundError("Customer");
            if (user.role !== client_1.UserRole.CUSTOMER)
                throw new customErrors_1.ForbiddenError();
            const customer = yield customerRepository_1.customerRepository.findByUserId(userId);
            if (!customer)
                throw new customErrors_1.ObjectNotFoundError("CustomerProfile");
            try {
                const requestFingerprint = (0, crypto_1.createHash)("sha256").update(JSON.stringify({ addressId: input.addressId.trim() })).digest("hex");
                const execution = yield this.repository.createIdempotentCheckout({
                    userId, customerId: customer.id, addressId: input.addressId.trim(), operation: "CHECKOUT_V1", key,
                    requestFingerprint, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), serialize: toCheckoutDto,
                });
                return { result: execution.result, replayed: execution.replayed };
            }
            catch (error) {
                if (error instanceof checkoutRepository_1.CheckoutNotFoundError)
                    throw new customErrors_1.ObjectNotFoundError(error.message.replace(" not found", ""));
                if (error instanceof checkoutRepository_1.CheckoutConflictError)
                    throw new customErrors_1.ConflictError(error.message);
                throw error;
            }
        });
    }
}
exports.CheckoutService = CheckoutService;
exports.checkoutService = new CheckoutService();
