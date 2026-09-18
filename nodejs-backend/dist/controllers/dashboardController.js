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
exports.dashboardRoutes = void 0;
const client_1 = require("@prisma/client");
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const dashboardService_1 = require("../services/dashboardService");
const customErrors_1 = require("../utils/customErrors");
const dashboardService = new dashboardService_1.DashboardService();
exports.dashboardRoutes = (0, express_1.Router)();
function dateOnly(value, field) {
    if (value === undefined)
        return undefined;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new customErrors_1.ValidationError(`Invalid ${field}`);
    }
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day) {
        throw new customErrors_1.ValidationError(`Invalid ${field}`);
    }
    return date;
}
function range(query) {
    const from = dateOnly(query.from, "from");
    const to = dateOnly(query.to, "to");
    if (from && to && from > to) {
        throw new customErrors_1.ValidationError("Invalid date range");
    }
    return { from, to };
}
function pagination(query) {
    const page = query.page === undefined ? 1 : Number(query.page);
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    if (!Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100) {
        throw new customErrors_1.ValidationError("Invalid pagination");
    }
    return { page, limit };
}
function status(query) {
    if (query.status === undefined)
        return undefined;
    if (typeof query.status !== "string" ||
        !Object.values(client_1.SellerOrderStatus).includes(query.status)) {
        throw new customErrors_1.ValidationError("Invalid status");
    }
    return query.status;
}
function topLimit(query) {
    const value = query.limit === undefined ? 5 : Number(query.limit);
    if (!Number.isSafeInteger(value) || value < 1 || value > 50) {
        throw new customErrors_1.ValidationError("Invalid limit");
    }
    return value;
}
function interval(query) {
    var _a;
    const value = (_a = query.interval) !== null && _a !== void 0 ? _a : "day";
    if (value !== "day" && value !== "month") {
        throw new customErrors_1.ValidationError("Invalid interval");
    }
    return value;
}
function handleError(error, res) {
    if (error instanceof customErrors_1.ValidationError) {
        res.status(400).json({ error: error.message });
        return;
    }
    if (error instanceof customErrors_1.ForbiddenError) {
        res.status(403).json({ error: error.message });
        return;
    }
    res.status(500).json({ error: "Internal Server Error" });
}
exports.dashboardRoutes.get("/seller/summary", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield dashboardService.getSummary(req.user, range(req.query)));
    }
    catch (error) {
        handleError(error, res);
    }
}));
exports.dashboardRoutes.get("/seller/orders", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield dashboardService.getOrders(req.user, range(req.query), pagination(req.query), status(req.query)));
    }
    catch (error) {
        handleError(error, res);
    }
}));
exports.dashboardRoutes.get("/seller/orders/by-status", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield dashboardService.getOrdersByStatus(req.user, range(req.query)));
    }
    catch (error) {
        handleError(error, res);
    }
}));
exports.dashboardRoutes.get("/seller/sales/timeseries", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield dashboardService.getTimeseries(req.user, range(req.query), interval(req.query)));
    }
    catch (error) {
        handleError(error, res);
    }
}));
exports.dashboardRoutes.get("/seller/sales/by-category", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield dashboardService.getByCategory(req.user, range(req.query)));
    }
    catch (error) {
        handleError(error, res);
    }
}));
exports.dashboardRoutes.get("/seller/products/top", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield dashboardService.getTopProducts(req.user, range(req.query), topLimit(req.query)));
    }
    catch (error) {
        handleError(error, res);
    }
}));
exports.dashboardRoutes.get("/seller/customers/new", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield dashboardService.getNewCustomers(req.user, range(req.query)));
    }
    catch (error) {
        handleError(error, res);
    }
}));
exports.dashboardRoutes.get("/seller/ratings", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield dashboardService.getRatings(req.user));
    }
    catch (error) {
        handleError(error, res);
    }
}));
