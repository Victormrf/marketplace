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
exports.CartItemService = void 0;
const cartItemModel_1 = require("../models/cartItemModel");
const customErrors_1 = require("../utils/customErrors");
class CartItemService {
    addToCart(cartItemData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!cartItemData.userId ||
                !cartItemData.productId ||
                !cartItemData.quantity) {
                throw new customErrors_1.ValidationError("Missing required fields");
            }
            return cartItemModel_1.CartItemModel.add(cartItemData);
        });
    }
    getUserCart(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const userCart = yield cartItemModel_1.CartItemModel.getByUser(userId);
            if (!userCart) {
                throw new customErrors_1.ObjectNotFoundError("User cart");
            }
            return userCart;
        });
    }
    updateQuantity(productId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            const cartItem = yield cartItemModel_1.CartItemModel.getByProductId(productId);
            if (!cartItem) {
                throw new customErrors_1.ObjectNotFoundError("Cart item");
            }
            return cartItemModel_1.CartItemModel.updateQuantity(cartItem.id, quantity);
        });
    }
    removeFromCart(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const cartItem = yield cartItemModel_1.CartItemModel.getById(id);
            if (!cartItem) {
                throw new customErrors_1.ObjectNotFoundError("Cart item");
            }
            return cartItemModel_1.CartItemModel.delete(id);
        });
    }
    removeProductFromCart(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cartItem = yield cartItemModel_1.CartItemModel.getByProductId(productId);
            if (!cartItem) {
                throw new customErrors_1.ObjectNotFoundError("Cart item");
            }
            return cartItemModel_1.CartItemModel.delete(cartItem.id);
        });
    }
    clearUserCart(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const userCart = yield cartItemModel_1.CartItemModel.getByUser(userId);
            if (!userCart) {
                throw new customErrors_1.ObjectNotFoundError("User cart");
            }
            return cartItemModel_1.CartItemModel.clearCart(userId);
        });
    }
}
exports.CartItemService = CartItemService;
