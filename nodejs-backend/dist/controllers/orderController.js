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
exports.sellerOrderRoutes = exports.orderRoutes = void 0;
const client_1 = require("@prisma/client");
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const orderService_1 = require("../services/orderService");
const customErrors_1 = require("../utils/customErrors");
exports.orderRoutes = (0, express_1.Router)();
const service = new orderService_1.OrderService();
function pagination(req) { const page = req.query.page === undefined ? 1 : Number(req.query.page); const limit = req.query.limit === undefined ? 20 : Number(req.query.limit); if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new customErrors_1.ValidationError("Invalid pagination"); return { page, limit }; }
function filters(query, seller = false) { const result = {}; const status = query.status; const allowed = seller ? Object.values(client_1.SellerOrderStatus) : Object.values(client_1.OrderStatus); if (status !== undefined) {
    if (typeof status !== "string" || !allowed.includes(status))
        throw new customErrors_1.ValidationError("Invalid status");
    result.status = status;
} for (const key of ["createdFrom", "createdTo"]) {
    const value = query[key];
    if (value !== undefined) {
        if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
            throw new customErrors_1.ValidationError(`Invalid ${key}`);
        result[key] = new Date(value);
    }
} if (result.createdFrom && result.createdTo && result.createdFrom > result.createdTo)
    throw new customErrors_1.ValidationError("Invalid date range"); return result; }
function handle(error, res) { if (error instanceof customErrors_1.ValidationError)
    return res.status(400).json({ error: error.message }); if (error instanceof customErrors_1.ForbiddenError)
    return res.status(403).json({ error: error.message }); if (error instanceof customErrors_1.ObjectNotFoundError)
    return res.status(404).json({ error: error.message }); if (error instanceof customErrors_1.ConflictError)
    return res.status(409).json({ error: error.message }); return res.status(500).json({ error: "Internal Server Error" }); }
exports.orderRoutes.get("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () { try {
    const p = pagination(req);
    res.status(200).json(yield service.listCustomerOrders(req.user.id, filters(req.query), p.page, p.limit));
}
catch (e) {
    handle(e, res);
} }));
exports.orderRoutes.get("/:orderId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () { try {
    res.status(200).json(yield service.getCustomerOrder(req.user.id, req.params.orderId));
}
catch (e) {
    handle(e, res);
} }));
exports.sellerOrderRoutes = (0, express_1.Router)();
exports.sellerOrderRoutes.get("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () { try {
    const p = pagination(req);
    res.status(200).json(yield service.listSellerOrders(req.user.id, filters(req.query, true), p.page, p.limit));
}
catch (e) {
    handle(e, res);
} }));
exports.sellerOrderRoutes.get("/:sellerOrderId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () { try {
    res.status(200).json(yield service.getSellerOrder(req.user.id, req.params.sellerOrderId));
}
catch (e) {
    handle(e, res);
} }));
exports.sellerOrderRoutes.patch("/:sellerOrderId/status", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () { try {
    if (!req.body || typeof req.body.status !== "string" || Object.keys(req.body).some((key) => !["status", "reason"].includes(key)) || (req.body.reason !== undefined && typeof req.body.reason !== "string"))
        throw new customErrors_1.ValidationError("Invalid transition payload");
    res.status(200).json(yield service.transitionSellerOrder(req.user, req.params.sellerOrderId, { status: req.body.status, reason: req.body.reason }));
}
catch (e) {
    handle(e, res);
} }));
