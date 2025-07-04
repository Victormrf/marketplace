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
exports.OrderItemService = void 0;
const db_1 = __importDefault(require("../config/db"));
const orderItemModel_1 = require("../models/orderItemModel");
const customErrors_1 = require("../utils/customErrors");
class OrderItemService {
    updateItemQuantity(itemId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            const item = yield orderItemModel_1.OrderItemModel.getById(itemId);
            if (!item) {
                throw new customErrors_1.ObjectNotFoundError("Order item");
            }
            return yield orderItemModel_1.OrderItemModel.updateQuantity(itemId, quantity);
        });
    }
    removeItemFromOrder(itemId) {
        return __awaiter(this, void 0, void 0, function* () {
            const item = yield orderItemModel_1.OrderItemModel.getById(itemId);
            if (!item) {
                throw new customErrors_1.ObjectNotFoundError("Order item");
            }
            // Executa a lógica dentro de uma transação
            return yield db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const { orderId, productId, quantity } = item;
                if (quantity === undefined) {
                    throw new customErrors_1.ValidationError("Order item has no quantity");
                }
                // Busca o preço do produto
                const product = yield tx.product.findUnique({
                    where: { id: productId },
                });
                if (!product) {
                    throw new customErrors_1.ObjectNotFoundError("Product");
                }
                const itemTotal = product.price * quantity;
                // Atualiza o total da ordem
                yield tx.order.update({
                    where: { id: orderId },
                    data: {
                        totalPrice: {
                            decrement: itemTotal,
                        },
                    },
                });
                // Deleta o item do pedido
                yield tx.order_item.delete({
                    where: { id: itemId },
                });
            }));
        });
    }
    getItemsByOrderId(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const items = yield orderItemModel_1.OrderItemModel.getByOrderId(orderId);
            if (!items.length) {
                throw new customErrors_1.ObjectNotFoundError("Order items");
            }
            return items;
        });
    }
}
exports.OrderItemService = OrderItemService;
