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
exports.OrderItemModel = void 0;
const db_1 = __importDefault(require("../config/db"));
class OrderItemModel {
    constructor(data = {}) {
        this.fill(data);
    }
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order_item.create({
                data: {
                    orderId: data.orderId,
                    productId: data.productId,
                    quantity: data.quantity,
                },
            });
        });
    }
    static getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order_item.findUnique({
                where: { id },
            });
        });
    }
    static getByOrderId(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const items = yield db_1.default.order_item.findMany({
                where: { orderId },
            });
            const itemsWithTotal = items.map((item) => (Object.assign(Object.assign({}, item), { totalPrice: item.quantity * item.unitPrice })));
            return itemsWithTotal;
        });
    }
    static getBestSellingProductsBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order_item.groupBy({
                by: ["productId"],
                where: {
                    product: {
                        sellerId: sellerId,
                    },
                },
                _sum: {
                    quantity: true,
                },
                orderBy: {
                    _sum: {
                        quantity: "desc",
                    },
                },
                take: 5, // ou qualquer número que represente os "mais vendidos"
            });
        });
    }
    static updateQuantity(itemId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.order_item.update({
                where: { id: itemId },
                data: { quantity },
            });
        });
    }
    fill(data) {
        if (data.id !== undefined)
            this.id = data.id;
        if (data.orderId !== undefined)
            this.orderId = data.orderId;
        if (data.productId !== undefined)
            this.productId = data.productId;
        if (data.quantity !== undefined)
            this.quantity = data.quantity;
        if (data.createdAt !== undefined)
            this.createdAt = data.createdAt;
    }
}
exports.OrderItemModel = OrderItemModel;
