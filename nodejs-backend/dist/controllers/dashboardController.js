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
const express_1 = require("express");
const dashboardService_1 = require("../services/dashboardService");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const customErrors_1 = require("../utils/customErrors");
const dashboardService = new dashboardService_1.DashboardService();
exports.dashboardRoutes = (0, express_1.Router)();
exports.dashboardRoutes.get("/sellers/salesStats/:sellerId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sellerId } = req.params;
    try {
        const stats = yield dashboardService.getSalesStats(sellerId);
        res.status(200).json(stats);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}));
exports.dashboardRoutes.get("/sellers/salesByCategory/:sellerId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sellerId } = req.params;
    try {
        const data = yield dashboardService.getSalesCountByCategory(sellerId);
        res.status(200).json(data);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: error });
    }
}));
exports.dashboardRoutes.get("/sellers/orders/:sellerId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sellerId } = req.params;
    try {
        const stats = yield dashboardService.getOrdersBySeller(sellerId);
        res.status(200).json(stats);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}));
exports.dashboardRoutes.get("/sellers/ordersByStatus/:sellerId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sellerId } = req.params;
    try {
        const stats = yield dashboardService.getOrdersCountByStatus(sellerId);
        res.status(200).json(stats);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}));
exports.dashboardRoutes.get("/sellers/lastSixMonthsSalesStats/:sellerId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sellerId } = req.params;
    try {
        const stats = yield dashboardService.getMonthlySalesStats(sellerId);
        res.status(200).json(stats);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}));
exports.dashboardRoutes.get("/sellers/lastThirtyDaysSalesStats/:sellerId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sellerId } = req.params;
    try {
        const stats = yield dashboardService.getDailySalesStats(sellerId);
        res.status(200).json(stats);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}));
exports.dashboardRoutes.get("/sellers/bestSellingProducts/:sellerId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sellerId } = req.params;
    try {
        const products = yield dashboardService.getBestSellingProducts(sellerId);
        res.status(200).json(products);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}));
exports.dashboardRoutes.get("/sellers/newCustomersByMonth/:sellerId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sellerId } = req.params;
    try {
        const products = yield dashboardService.getNewCustomersPerMonth(sellerId);
        res.status(200).json(products);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}));
exports.dashboardRoutes.get("/sellers/ratingDistribution/:sellerId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sellerId } = req.params;
    try {
        const products = yield dashboardService.getRatingDistributionOfSeller(sellerId);
        res.status(200).json(products);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}));
