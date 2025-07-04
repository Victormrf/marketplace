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
exports.paymentRoutes = void 0;
const express_1 = require("express");
const paymentService_1 = require("../services/paymentService");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const customErrors_1 = require("../utils/customErrors");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
exports.paymentRoutes = (0, express_1.Router)();
const paymentService = new paymentService_1.PaymentService();
exports.paymentRoutes.post("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId, amount } = req.body;
    if (!orderId || typeof amount !== "number" || amount <= 0) {
        res.status(400).json({ error: "Missing or invalid fields" });
        return;
    }
    try {
        const payment = yield paymentService.processPayment(orderId, amount);
        res.status(201).json(payment);
    }
    catch (error) {
        if (error instanceof customErrors_1.ValidationError) {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
}));
exports.paymentRoutes.get("/order/:orderId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    try {
        const payment = yield paymentService.getPaymentDetails(orderId);
        res.status(200).json(payment);
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
exports.paymentRoutes.get("/customer/:customerId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { customerId } = req.params;
    try {
        const payments = yield paymentService.getPaymentsByCustomer(customerId);
        res.status(200).json(payments);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error });
        }
    }
}));
exports.paymentRoutes.put("/:paymentId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const requestorRole = req.user.role;
    const { paymentId } = req.params;
    const updateData = req.body;
    if (requestorRole !== "admin" && requestorRole !== "seller") {
        res.status(403).json({ error: "Access denied." });
        return;
    }
    if (!updateData || Object.keys(updateData).length === 0) {
        res.status(400).json({ error: "No fields to update" });
        return;
    }
    const allowedStatuses = ["PENDING", "COMPLETED", "FAILED"];
    if (updateData.status &&
        !allowedStatuses.includes(updateData.status.toUpperCase())) {
        res.status(400).json({ error: "Invalid payment status" });
        return;
    }
    try {
        const updatedPayment = yield paymentService.updatePayment(paymentId, updateData);
        res.status(200).json(updatedPayment);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
}));
exports.paymentRoutes.put("/:paymentId/status", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { paymentId } = req.params;
    const { status } = req.body;
    const allowedStatuses = ["PENDING", "COMPLETED", "FAILED"];
    if (!allowedStatuses.includes(status === null || status === void 0 ? void 0 : status.toUpperCase())) {
        res.status(400).json({ error: "Invalid payment status" });
        return;
    }
    try {
        const updatedPayment = yield paymentService.updatePaymentStatus(paymentId, status);
        res.status(200).json(updatedPayment);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
}));
exports.paymentRoutes.delete("/:paymentId", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { paymentId } = req.params;
    try {
        yield paymentService.deletePayment(paymentId);
        res.status(204).send();
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
