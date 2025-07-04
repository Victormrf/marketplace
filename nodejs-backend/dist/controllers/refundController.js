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
exports.refundRoutes = void 0;
const express_1 = require("express");
const refundService_1 = require("../services/refundService");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const customErrors_1 = require("../utils/customErrors");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
exports.refundRoutes = (0, express_1.Router)();
const refundService = new refundService_1.RefundService();
exports.refundRoutes.post("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { paymentId, reason, amount } = req.body;
    try {
        const refund = yield refundService.requestRefund(paymentId, reason, amount);
        res.status(201).json(refund);
    }
    catch (error) {
        if (error instanceof customErrors_1.ValidationError) {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(500).json({ error });
        }
    }
}));
exports.refundRoutes.get("/:refundId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { refundId } = req.params;
    try {
        const refund = yield refundService.getRefundById(refundId);
        res.status(200).json(refund);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error });
        }
    }
}));
// refundRoutes.get("/customer/:customerId", authMiddleware, async (req, res) => {
//   const { customerId } = req.params;
//   try {
//     const refunds = await refundService.getRefundsByCustomer(customerId);
//     res.status(200).json(refunds);
//   } catch (error) {
//     if (error instanceof ObjectsNotFoundError) {
//       res.status(404).json({ error: error.message });
//     } else {
//       res.status(500).json({ error });
//     }
//   }
// });
exports.refundRoutes.put("/:refundId/status", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { refundId } = req.params;
    const { status } = req.body;
    try {
        const updatedRefund = yield refundService.updateRefundStatus(refundId, status);
        res.status(200).json(updatedRefund);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error });
        }
    }
}));
exports.refundRoutes.delete("/:refundId", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { refundId } = req.params;
    try {
        yield refundService.deleteRefund(refundId);
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error });
        }
    }
}));
