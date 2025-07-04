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
exports.CartItemModel = void 0;
const db_1 = __importDefault(require("../config/db"));
class CartItemModel {
    static add(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingItem = yield db_1.default.cart_item.findFirst({
                where: {
                    userId: data.userId,
                    productId: data.productId,
                },
            });
            if (existingItem) {
                return db_1.default.cart_item.update({
                    where: { id: existingItem.id },
                    data: {
                        quantity: existingItem.quantity + 1,
                    },
                });
            }
            else {
                return db_1.default.cart_item.create({ data });
            }
        });
    }
    static getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.cart_item.findUnique({
                where: { id },
            });
        });
    }
    static getByProductId(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.cart_item.findFirst({
                where: { productId },
            });
        });
    }
    static getByUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.cart_item.findMany({
                where: { userId },
                include: {
                    product: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            });
        });
    }
    static updateQuantity(id, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.cart_item.update({
                where: { id },
                data: { quantity },
            });
        });
    }
    static delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.cart_item.delete({ where: { id } });
        });
    }
    static clearCart(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.cart_item.deleteMany({ where: { userId } });
        });
    }
}
exports.CartItemModel = CartItemModel;
