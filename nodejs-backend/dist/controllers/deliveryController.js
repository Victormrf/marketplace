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
const client_1 = require("@prisma/client");
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const deliveryService_1 = require("../services/deliveryService");
const customErrors_1 = require("../utils/customErrors");
exports.deliveryRoutes = (0, express_1.Router)();
const service = new deliveryService_1.DeliveryService();
function errorResponse(error, res) {
    if (error instanceof customErrors_1.ValidationError) {
        res.status(400).json({ error: error.message });
        return;
    }
    if (error instanceof customErrors_1.ForbiddenError) {
        res.status(403).json({ error: error.message });
        return;
    }
    if (error instanceof customErrors_1.ObjectNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
    }
    if (error instanceof customErrors_1.ConflictError) {
        res.status(409).json({ error: error.message });
        return;
    }
    res.status(500).json({ error: "Internal Server Error" });
}
function tracking(body, allowEmpty = false) {
    const allowed = ["trackingCode", "carrier", "estimatedDelivery"];
    if ((!allowEmpty && !Object.keys(body).length) ||
        Object.keys(body).some((key) => !allowed.includes(key)))
        throw new customErrors_1.ValidationError("Invalid tracking fields");
    const result = {};
    if (Object.prototype.hasOwnProperty.call(body, "trackingCode"))
        result.trackingCode = body.trackingCode;
    if (Object.prototype.hasOwnProperty.call(body, "carrier"))
        result.carrier = body.carrier;
    if (Object.prototype.hasOwnProperty.call(body, "estimatedDelivery"))
        result.estimatedDelivery =
            body.estimatedDelivery === null
                ? null
                : new Date(body.estimatedDelivery);
    return result;
}
exports.deliveryRoutes.post("/seller-orders/:sellerOrderId/delivery", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(201)
            .json(yield service.createDelivery(req.user, req.params.sellerOrderId, tracking((req.body || {}), true)));
    }
    catch (error) {
        errorResponse(error, res);
    }
}));
exports.deliveryRoutes.get("/seller-orders/:sellerOrderId/delivery", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(200)
            .json(yield service.getBySellerOrder(req.user, req.params.sellerOrderId));
    }
    catch (error) {
        errorResponse(error, res);
    }
}));
exports.deliveryRoutes.get("/deliveries/:deliveryId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield service.get(req.user, req.params.deliveryId));
    }
    catch (error) {
        errorResponse(error, res);
    }
}));
exports.deliveryRoutes.get("/deliveries/:deliveryId/history", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(200)
            .json(yield service.history(req.user, req.params.deliveryId));
    }
    catch (error) {
        errorResponse(error, res);
    }
}));
exports.deliveryRoutes.patch("/deliveries/:deliveryId/status", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const body = (req.body || {});
        if (Object.keys(body).some((key) => key !== "status" && key !== "reason") ||
            typeof body.status !== "string" ||
            !Object.values(client_1.DeliveryStatus).includes(body.status))
            throw new customErrors_1.ValidationError("Invalid delivery status payload");
        const input = {
            status: body.status,
            reason: body.reason,
        };
        res
            .status(200)
            .json(yield service.transition(req.user, req.params.deliveryId, input));
    }
    catch (error) {
        errorResponse(error, res);
    }
}));
exports.deliveryRoutes.patch("/deliveries/:deliveryId/tracking", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(200)
            .json(yield service.updateTracking(req.user, req.params.deliveryId, tracking((req.body || {}))));
    }
    catch (error) {
        errorResponse(error, res);
    }
}));
