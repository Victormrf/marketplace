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
exports.orderRoutes = void 0;
const express_1 = require("express");
const orderService_1 = require("../services/orderService");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const customErrors_1 = require("../utils/customErrors");
const console_1 = require("console");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
exports.orderRoutes = (0, express_1.Router)();
const orderService = new orderService_1.OrderService();
exports.orderRoutes.post("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { customerId, items } = req.body; // items: [{ productId, quantity }]
    try {
        const newOrder = yield orderService.createOrderWithItems(customerId, items);
        res.status(201).json({ message: "Order created with items", newOrder });
    }
    catch (error) {
        console.log(error);
        if (error instanceof customErrors_1.ValidationError) {
            res.status(400).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ error: "Internal Server Error" });
            return;
        }
    }
}));
exports.orderRoutes.get("/:orderId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    try {
        const order = yield orderService.getOrderById(orderId);
        res.status(200).json({ order });
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    }
}));
exports.orderRoutes.get("/customer/:customerId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { customerId } = req.params;
    try {
        const orders = yield orderService.getOrdersByCustomerId(customerId);
        res.status(200).json({ orders });
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    }
}));
exports.orderRoutes.put("/:orderId", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    const updateData = req.body;
    if (!updateData || Object.keys(updateData).length === 0) {
        res.status(400).json({ error: "No fields to update" });
        return;
    }
    try {
        const updatedOrder = yield orderService.updateOrder(orderId, updateData);
        res.status(200).json(updatedOrder);
    }
    catch (_a) {
        if (console_1.error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: console_1.error.message });
            return;
        }
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}));
exports.orderRoutes.put("/:orderId/status", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    const { status } = req.body;
    try {
        const updatedOrder = yield orderService.updateOrderStatus(orderId, status);
        res.status(200).json(updatedOrder);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ error });
            return;
        }
    }
}));
exports.orderRoutes.delete("/:orderId", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    try {
        const deletedOrder = yield orderService.deleteOrder(orderId);
        res
            .status(200)
            .json({ message: "Order deleted successfully", deletedOrder });
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}));
