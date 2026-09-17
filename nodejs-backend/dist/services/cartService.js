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
exports.cartService = exports.CartService = void 0;
const client_1 = require("@prisma/client");
const cartRepository_1 = require("../repositories/cartRepository");
const customerRepository_1 = require("../repositories/customerRepository");
const userRepository_1 = require("../repositories/userRepository");
const customErrors_1 = require("../utils/customErrors");
function exactFields(input, allowed) {
    const unknown = Object.keys(input).find((key) => !allowed.includes(key));
    if (unknown)
        throw new customErrors_1.ValidationError(`Unsupported cart field: ${unknown}`);
}
function positiveQuantity(value) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
        throw new customErrors_1.ValidationError("quantity must be a positive integer");
    }
    return value;
}
function productId(value) {
    if (typeof value !== "string" || value.trim() === "")
        throw new customErrors_1.ValidationError("productId is required");
    return value.trim();
}
function toDto(cart) {
    const items = cart.items.map((item) => {
        var _a, _b, _c, _d;
        const onHand = (_b = (_a = item.product.inventory) === null || _a === void 0 ? void 0 : _a.onHandQuantity) !== null && _b !== void 0 ? _b : 0;
        const reserved = (_d = (_c = item.product.inventory) === null || _c === void 0 ? void 0 : _c.reservedQuantity) !== null && _d !== void 0 ? _d : 0;
        const available = onHand - reserved;
        const hasSufficientStock = item.product.inventory !== null && available >= item.quantity;
        return {
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            name: item.product.name,
            priceInCents: item.product.priceInCents,
            currency: item.product.currency,
            image: item.product.image,
            availableQuantity: available,
            hasSufficientStock,
            isAvailable: item.product.isActive &&
                item.product.seller.isActive &&
                hasSufficientStock,
            lineTotalInCents: item.quantity * item.product.priceInCents,
        };
    });
    return {
        id: cart.id,
        status: "ACTIVE",
        items,
        totalInCents: items.reduce((total, item) => total + item.lineTotalInCents, 0),
    };
}
class CartService {
    customerIdFor(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield userRepository_1.userRepository.findById(userId);
            if (!user || !user.isActive)
                throw new customErrors_1.ObjectNotFoundError("Customer");
            if (user.role !== client_1.UserRole.CUSTOMER)
                throw new customErrors_1.ForbiddenError();
            const customer = yield customerRepository_1.customerRepository.findByUserId(userId);
            if (!customer)
                throw new customErrors_1.ObjectNotFoundError("CustomerProfile");
            return customer.id;
        });
    }
    getCart(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const customerId = yield this.customerIdFor(userId);
            yield cartRepository_1.cartRepository.findOrCreateActive(customerId);
            const cart = yield cartRepository_1.cartRepository.findActiveCart(customerId);
            if (!cart)
                throw new customErrors_1.ObjectNotFoundError("Cart");
            return toDto(cart);
        });
    }
    addItem(userId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            exactFields(input, ["productId", "quantity"]);
            const customerId = yield this.customerIdFor(userId);
            try {
                yield cartRepository_1.cartRepository.addItem(customerId, productId(input.productId), positiveQuantity(input.quantity));
            }
            catch (error) {
                if (error instanceof cartRepository_1.CartMutationConflictError)
                    throw new customErrors_1.ConflictError("Product is unavailable or stock is insufficient");
                throw error;
            }
            return this.getCart(userId);
        });
    }
    updateItem(userId, rawProductId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            exactFields(input, ["quantity"]);
            const customerId = yield this.customerIdFor(userId);
            const updated = yield cartRepository_1.cartRepository.updateItem(customerId, productId(rawProductId), positiveQuantity(input.quantity));
            if (!updated)
                throw new customErrors_1.ConflictError("Cart item is unavailable or stock is insufficient");
            return this.getCart(userId);
        });
    }
    removeItem(userId, rawProductId) {
        return __awaiter(this, void 0, void 0, function* () {
            const customerId = yield this.customerIdFor(userId);
            const removed = yield cartRepository_1.cartRepository.removeItem(customerId, productId(rawProductId));
            if (!removed)
                throw new customErrors_1.ObjectNotFoundError("CartItem");
        });
    }
    clear(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.customerIdFor(userId).then((customerId) => cartRepository_1.cartRepository.clear(customerId));
        });
    }
}
exports.CartService = CartService;
exports.cartService = new CartService();
