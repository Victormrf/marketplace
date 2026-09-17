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
const client_1 = require("@prisma/client");
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const paymentService_1 = require("../services/paymentService");
const customErrors_1 = require("../utils/customErrors");
exports.paymentRoutes = (0, express_1.Router)();
const service = new paymentService_1.PaymentService();
function paging(q) {
    const page = q.page === undefined ? 1 : Number(q.page);
    const limit = q.limit === undefined ? 20 : Number(q.limit);
    if (!Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100)
        throw new customErrors_1.ValidationError("Invalid pagination");
    return { page, limit };
}
function filters(q) {
    const result = {};
    if (q.status !== undefined) {
        if (typeof q.status !== "string" ||
            !Object.values(client_1.PaymentAttemptStatus).includes(q.status))
            throw new customErrors_1.ValidationError("Invalid status");
        result.status = q.status;
    }
    if (q.method !== undefined) {
        if (typeof q.method !== "string" ||
            !Object.values(client_1.PaymentMethod).includes(q.method))
            throw new customErrors_1.ValidationError("Invalid method");
        result.method = q.method;
    }
    for (const key of ["createdFrom", "createdTo"])
        if (q[key] !== undefined) {
            if (typeof q[key] !== "string" || Number.isNaN(Date.parse(q[key])))
                throw new customErrors_1.ValidationError(`Invalid ${key}`);
            result[key] = new Date(q[key]);
        }
    if (result.createdFrom &&
        result.createdTo &&
        result.createdFrom > result.createdTo)
        throw new customErrors_1.ValidationError("Invalid date range");
    return result;
}
function handle(error, res) {
    if (error instanceof customErrors_1.ValidationError)
        return res.status(400).json({ error: error.message });
    if (error instanceof customErrors_1.ForbiddenError)
        return res.status(403).json({ error: error.message });
    if (error instanceof customErrors_1.ObjectNotFoundError)
        return res.status(404).json({ error: error.message });
    if (error instanceof customErrors_1.ConflictError)
        return res.status(409).json({ error: error.message });
    return res.status(500).json({ error: "Internal Server Error" });
}
exports.paymentRoutes.post("/orders/:orderId/payment-attempts", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.body ||
            Object.keys(req.body).length !== 1 ||
            typeof req.body.method !== "string" ||
            !Object.values(client_1.PaymentMethod).includes(req.body.method))
            throw new customErrors_1.ValidationError("Only method is accepted");
        res
            .status(201)
            .json(yield service.createAttempt(req.user, req.params.orderId, {
            method: req.body.method,
        }));
    }
    catch (e) {
        handle(e, res);
    }
}));
exports.paymentRoutes.get("/orders/:orderId/payment-attempts", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const p = paging(req.query);
        res
            .status(200)
            .json(yield service.listAttempts(req.user, req.params.orderId, filters(req.query), p.page, p.limit));
    }
    catch (e) {
        handle(e, res);
    }
}));
exports.paymentRoutes.get("/payment-attempts/:paymentAttemptId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(200)
            .json(yield service.getAttempt(req.user, req.params.paymentAttemptId));
    }
    catch (e) {
        handle(e, res);
    }
}));
