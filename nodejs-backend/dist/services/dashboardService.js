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
const orderRepository_1 = require("../repositories/orderRepository");
const productRepository_1 = require("../repositories/productRepository");
const reviewRepository_1 = require("../repositories/reviewRepository");
const date_fns_1 = require("date-fns");
class DashboardService {
    constructor() {
        this.orderRepository = new orderRepository_1.OrderRepository();
    }
    getSalesStats(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const items = yield this.orderRepository.getCompletedOrderItemsBySeller(sellerId);
            const totalSales = items.reduce((sum, item) => sum + item.quantity * item.unitPriceInCents, 0);
            const totalItemsSold = items.reduce((sum, item) => sum + item.quantity, 0);
            return {
                totalSales,
                totalItemsSold,
            };
        });
    }
    getOrdersCountByStatus(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const orders = yield this.orderRepository.getOrdersByStatus(sellerId);
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
            const orderItems = yield this.orderRepository.getCompletedOrderItemsByCategory(sellerId);
            const categoryTotals = {};
            for (const item of orderItems) {
                const category = item.product.category;
                const totalItemValue = item.quantity * item.unitPriceInCents;
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
            const orders = yield this.orderRepository.getMonthlySalesBySeller(sellerId);
            const monthlySalesMap = {};
            for (const order of orders) {
                const monthKey = (0, date_fns_1.format)(order.createdAt, "yyyy-MM"); // Ex: "2025-05"
                if (!monthlySalesMap[monthKey]) {
                    monthlySalesMap[monthKey] = 0;
                }
                monthlySalesMap[monthKey] += order.totalInCents || 0;
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
            const orders = yield this.orderRepository.getDailySalesBySeller(sellerId);
            const dailySalesMap = {};
            for (const order of orders) {
                const dayKey = (0, date_fns_1.format)(order.createdAt, "yyyy-MM-dd"); // Ex: "2025-05-05"
                if (!dailySalesMap[dayKey]) {
                    dailySalesMap[dayKey] = 0;
                }
                dailySalesMap[dayKey] += order.totalInCents || 0;
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
            return yield this.orderRepository.getOrdersBySeller(sellerId);
        });
    }
    getBestSellingProducts(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const groupedData = yield this.orderRepository.getBestSellingProductsBySeller(sellerId);
            const productIds = groupedData
                .map((item) => item.productId)
                .filter((id) => typeof id === "string");
            const products = yield productRepository_1.productRepository.getProductsByIds(productIds);
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
            return yield this.orderRepository.getNewCustomersByMonth(sellerId);
        });
    }
    getRatingDistributionOfSeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield reviewRepository_1.reviewRepository.ratingDistributionBySeller(sellerId);
        });
    }
}
exports.DashboardService = DashboardService;
