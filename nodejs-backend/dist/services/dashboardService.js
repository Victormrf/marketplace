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
exports.DashboardService = void 0;
const orderItemModel_1 = require("../models/orderItemModel");
const orderModel_1 = require("../models/orderModel");
const productModel_1 = require("../models/productModel");
const reviewModel_1 = require("../models/reviewModel");
const date_fns_1 = require("date-fns");
class DashboardService {
    getSalesStats(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const items = yield orderModel_1.OrderModel.getCompletedOrderItemsBySeller(sellerId);
            const totalSales = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
            const totalItemsSold = items.reduce((sum, item) => sum + item.quantity, 0);
            return {
                totalSales,
                totalItemsSold,
            };
        });
    }
    getOrdersCountByStatus(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const orders = yield orderModel_1.OrderModel.getOrdersByStatus(sellerId);
            const statusTotals = {};
            for (const order of orders) {
                const status = order.status;
                if (status) {
                    statusTotals[status] = (statusTotals[status] || 0) + 1;
                }
            }
            return Object.entries(statusTotals).map(([status, count]) => ({
                status: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
                count,
            }));
        });
    }
    getSalesCountByCategory(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const orderItems = yield orderModel_1.OrderModel.getCompletedOrderItemsByCategory(sellerId);
            const categoryTotals = {};
            for (const item of orderItems) {
                const category = item.product.category;
                const totalItemValue = item.quantity * item.unitPrice;
                if (category) {
                    categoryTotals[category] =
                        (categoryTotals[category] || 0) + totalItemValue;
                }
            }
            return Object.entries(categoryTotals).map(([category, totalSales]) => ({
                category,
                totalSales,
            }));
        });
    }
    getMonthlySalesStats(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const orders = yield orderModel_1.OrderModel.getMonthlySalesBySeller(sellerId);
            const monthlySalesMap = {};
            for (const order of orders) {
                const monthKey = (0, date_fns_1.format)(order.createdAt, "yyyy-MM"); // Ex: "2025-05"
                if (!monthlySalesMap[monthKey]) {
                    monthlySalesMap[monthKey] = 0;
                }
                monthlySalesMap[monthKey] += order.totalPrice || 0;
            }
            // Garante que todos os últimos 6 meses estejam no retorno, mesmo que com 0
            const result = [];
            const now = new Date();
            for (let i = 5; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = (0, date_fns_1.format)(date, "yyyy-MM");
                result.push({
                    date: key,
                    revenue: monthlySalesMap[key] || 0,
                });
            }
            return result;
        });
    }
    getDailySalesStats(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const orders = yield orderModel_1.OrderModel.getDailySalesBySeller(sellerId);
            const dailySalesMap = {};
            for (const order of orders) {
                const dayKey = (0, date_fns_1.format)(order.createdAt, "yyyy-MM-dd"); // Ex: "2025-05-05"
                if (!dailySalesMap[dayKey]) {
                    dailySalesMap[dayKey] = 0;
                }
                dailySalesMap[dayKey] += order.totalPrice || 0;
            }
            // Garante que todos os últimos 6 meses estejam no retorno, mesmo que com 0
            const result = [];
            const now = new Date();
            for (let i = 30; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(now.getDate() - i);
                const key = (0, date_fns_1.format)(date, "yyyy-MM-dd");
                result.push({
                    date: key,
                    revenue: dailySalesMap[key] || 0,
                });
            }
            return result;
        });
    }
    getOrdersBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield orderModel_1.OrderModel.getOrdersBySeller(sellerId);
        });
    }
    getBestSellingProducts(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const groupedData = yield orderItemModel_1.OrderItemModel.getBestSellingProductsBySeller(sellerId);
            const productIds = groupedData
                .map((item) => item.productId)
                .filter((id) => typeof id === "string");
            const products = yield productModel_1.ProductModel.getProductsByIds(productIds);
            const result = products.map((product) => {
                var _a;
                const quantityData = groupedData.find((item) => item.productId === product.id);
                return Object.assign(Object.assign({}, product), { totalSold: ((_a = quantityData === null || quantityData === void 0 ? void 0 : quantityData._sum) === null || _a === void 0 ? void 0 : _a.quantity) || 0 });
            });
            return result;
        });
    }
    getNewCustomersPerMonth(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield orderModel_1.OrderModel.getNewCustomersByMonth(sellerId);
        });
    }
    getRatingDistributionOfSeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield reviewModel_1.ReviewModel.getRatingDistributionBySeller(sellerId);
        });
    }
}
exports.DashboardService = DashboardService;
