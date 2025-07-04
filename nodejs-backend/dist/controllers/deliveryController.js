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
exports.deliveryRoutes = void 0;
const express_1 = require("express");
const deliveryService_1 = require("../services/deliveryService");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const customErrors_1 = require("../utils/customErrors");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
exports.deliveryRoutes = (0, express_1.Router)();
const deliveryService = new deliveryService_1.DeliveryService();
exports.deliveryRoutes.post("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId, status, trackingCode, estimatedDelivery } = req.body;
    try {
        const delivery = yield deliveryService.createDelivery(orderId, status, trackingCode, estimatedDelivery ? new Date(estimatedDelivery) : undefined);
        res.status(201).json(delivery);
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
exports.deliveryRoutes.get("/order/:orderId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    try {
        const delivery = yield deliveryService.getDeliveryDetails(orderId);
        res.status(200).json(delivery);
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
exports.deliveryRoutes.put("/:orderId/status", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    const { status } = req.body;
    try {
        const updated = yield deliveryService.updateDeliveryStatus(orderId, status);
        res.status(200).json(updated);
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
exports.deliveryRoutes.put("/:orderId/tracking", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    const { trackingCode, estimatedDelivery } = req.body;
    try {
        const updated = yield deliveryService.updateTrackingInfo(orderId, trackingCode, new Date(estimatedDelivery));
        res.status(200).json(updated);
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
exports.deliveryRoutes.delete("/:orderId", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId } = req.params;
    try {
        yield deliveryService.deleteDelivery(orderId);
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
