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
exports.OrderService = void 0;
const db_1 = __importDefault(require("../config/db"));
const orderModel_1 = require("../models/orderModel");
const customErrors_1 = require("../utils/customErrors");
class OrderService {
    createOrderWithItems(customerId, items) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!customerId || !(items === null || items === void 0 ? void 0 : items.length)) {
                throw new customErrors_1.ValidationError("Customer ID and items are required.");
            }
            return yield db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Buscar os preços dos produtos
                const productIds = items.map((item) => item.productId);
                const products = yield tx.product.findMany({
                    where: { id: { in: productIds } },
                    select: { id: true, price: true },
                });
                const productMap = new Map(products.map((p) => [p.id, p.price]));
                // Calcular o totalPrice
                let totalPrice = 0;
                const orderItemsData = items.map(({ productId, quantity }) => {
                    const unitPrice = productMap.get(productId);
                    if (unitPrice === undefined) {
                        throw new customErrors_1.ValidationError(`Product ${productId} not found.`);
                    }
                    const itemTotal = unitPrice * quantity;
                    totalPrice += itemTotal;
                    return {
                        productId,
                        quantity,
                        unitPrice,
                    };
                });
                // Criar a order
                const order = yield tx.order.create({
                    data: {
                        customerId,
                        totalPrice,
                        status: "PENDING",
                    },
                });
                // Criar os order_items
                yield tx.order_item.createMany({
                    data: orderItemsData.map((item) => ({
                        orderId: order.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                    })),
                });
                return order;
            }));
        });
    }
    getOrderById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield orderModel_1.OrderModel.getById(id);
            if (!order) {
                throw new customErrors_1.ObjectNotFoundError("Order");
            }
            return order;
        });
    }
    getOrdersByCustomerId(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const orders = yield orderModel_1.OrderModel.getOrdersByCustomerId(customerId);
            if (!orders.length) {
                throw new customErrors_1.ObjectsNotFoundError("Orders");
            }
            return orders;
        });
    }
    updateOrder(id, orderData) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield orderModel_1.OrderModel.getById(id);
            if (!order) {
                throw new customErrors_1.ObjectNotFoundError("Order");
            }
            try {
                return yield orderModel_1.OrderModel.update(id, orderData);
            }
            catch (error) {
                throw new Error(`Failed to update order: ${error.message}`);
            }
        });
    }
    updateOrderStatus(orderId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield orderModel_1.OrderModel.getById(orderId);
            if (!order) {
                throw new customErrors_1.ObjectNotFoundError("order");
            }
            try {
                return yield orderModel_1.OrderModel.updateStatus(orderId, status);
            }
            catch (error) {
                throw new Error(`Failed to update order status: ${error.message}`);
            }
        });
    }
    deleteOrder(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield orderModel_1.OrderModel.getById(id);
            if (!order) {
                throw new customErrors_1.ObjectNotFoundError("Order");
            }
            return yield orderModel_1.OrderModel.delete(id);
        });
    }
}
exports.OrderService = OrderService;
