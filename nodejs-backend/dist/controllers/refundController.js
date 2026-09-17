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
const client_1 = require("@prisma/client");
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const refundService_1 = require("../services/refundService");
const customErrors_1 = require("../utils/customErrors");
exports.refundRoutes = (0, express_1.Router)();
const service = new refundService_1.RefundService();
function pagination(q) {
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
            !Object.values(client_1.RefundStatus).includes(q.status))
            throw new customErrors_1.ValidationError("Invalid status");
        result.status = q.status;
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
exports.refundRoutes.post("/payment-attempts/:paymentAttemptId/refunds", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const body = (req.body || {});
        const keys = Object.keys(body);
        if (keys.some((key) => key !== "amountInCents" && key !== "reason") ||
            !Object.prototype.hasOwnProperty.call(body, "amountInCents"))
            throw new customErrors_1.ValidationError("Only amountInCents and reason are accepted");
        if (typeof body.amountInCents !== "number")
            throw new customErrors_1.ValidationError("amountInCents must be a number");
        res
            .status(201)
            .json(yield service.requestRefund(req.user, req.params.paymentAttemptId, {
            amountInCents: body.amountInCents,
            reason: body.reason,
        }));
    }
    catch (error) {
        handle(error, res);
    }
}));
exports.refundRoutes.get("/payment-attempts/:paymentAttemptId/refunds", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const p = pagination(req.query);
        res
            .status(200)
            .json(yield service.list(req.user, req.params.paymentAttemptId, filters(req.query), p.page, p.limit));
    }
    catch (error) {
        handle(error, res);
    }
}));
exports.refundRoutes.get("/refunds/:refundId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield service.get(req.user, req.params.refundId));
    }
    catch (error) {
        handle(error, res);
    }
}));
