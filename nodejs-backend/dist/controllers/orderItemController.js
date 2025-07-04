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
exports.orderItemRoutes = void 0;
const express_1 = require("express");
const orderItemService_1 = require("../services/orderItemService");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const customErrors_1 = require("../utils/customErrors");
exports.orderItemRoutes = (0, express_1.Router)();
const orderItemService = new orderItemService_1.OrderItemService();
// Atualizar quantidade do item
exports.orderItemRoutes.put("/:itemId/setQuantity", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { itemId } = req.params;
    const { quantity } = req.body;
    try {
        const updatedItem = yield orderItemService.updateItemQuantity(itemId, quantity);
        res.status(200).json(updatedItem);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error });
        }
    }
}));
// Remover item do pedido
exports.orderItemRoutes.delete("/:itemId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { itemId } = req.params;
    try {
        yield orderItemService.removeItemFromOrder(itemId);
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error });
        }
    }
}));
// Listar itens de um pedido
exports.orderItemRoutes.get("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    try {
        const items = yield orderItemService.getItemsByOrderId(orderId);
        res.status(200).json(items);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error });
        }
    }
}));
