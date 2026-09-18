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
const client_1 = require("@prisma/client");
const dashboardRepository_1 = require("../repositories/dashboardRepository");
const reviewRepository_1 = require("../repositories/reviewRepository");
const sellerRepository_1 = require("../repositories/sellerRepository");
const customErrors_1 = require("../utils/customErrors");
class DashboardService {
    sellerIdFor(user) {
        return __awaiter(this, void 0, void 0, function* () {
            if (user.role !== client_1.UserRole.SELLER)
                throw new customErrors_1.ForbiddenError();
            const seller = yield sellerRepository_1.sellerRepository.findByUserId(user.id);
            if (!seller)
                throw new customErrors_1.ForbiddenError();
            return seller.id;
        });
    }
    range(input = {}) {
        var _a;
        const to = (_a = input.to) !== null && _a !== void 0 ? _a : new Date();
        const toExclusive = new Date(to);
        toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
        const from = input.from ? new Date(input.from) : new Date(toExclusive);
        if (!input.from)
            from.setUTCDate(from.getUTCDate() - 30);
        if (Number.isNaN(from.getTime()) || Number.isNaN(toExclusive.getTime())) {
            throw new customErrors_1.ValidationError("Invalid date range");
        }
        if (from >= toExclusive)
            throw new customErrors_1.ValidationError("Invalid date range");
        if (toExclusive.getTime() - from.getTime() > 366 * 86400000) {
            throw new customErrors_1.ValidationError("Dashboard date range is too large");
        }
        return { from, toExclusive };
    }
    toOrderDto(record) {
        return {
            id: record.id,
            status: record.status,
            totalInCents: record.totalInCents,
            currency: "BRL",
            createdAt: record.createdAt,
            completedAt: record.completedAt,
        };
    }
    getSummary(user, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const sellerId = yield this.sellerIdFor(user);
            const result = yield dashboardRepository_1.dashboardRepository.summary(sellerId, this.range(input));
            return {
                currency: "BRL",
                grossRevenueInCents: result.grossRevenueInCents,
                deliveredSellerOrders: result.deliveredSellerOrders,
                itemsSold: result.itemsSold,
                averageTicketInCents: result.deliveredSellerOrders === 0
                    ? 0
                    : Math.round(result.grossRevenueInCents / result.deliveredSellerOrders),
            };
        });
    }
    getOrders(user, input, pagination, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const sellerId = yield this.sellerIdFor(user);
            const range = this.range(input);
            const total = yield dashboardRepository_1.dashboardRepository.countOrders(sellerId, range, status);
            const records = yield dashboardRepository_1.dashboardRepository.findOrders(sellerId, range, (pagination.page - 1) * pagination.limit, pagination.limit, status);
            return {
                data: records.map((record) => this.toOrderDto(record)),
                pagination: Object.assign(Object.assign({}, pagination), { total, totalPages: Math.ceil(total / pagination.limit) }),
            };
        });
    }
    getOrdersByStatus(user, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const sellerId = yield this.sellerIdFor(user);
            const counts = yield dashboardRepository_1.dashboardRepository.countByStatus(sellerId, this.range(input));
            const byStatus = new Map(counts.map((item) => [item.status, item.count]));
            return Object.values(client_1.SellerOrderStatus).map((status) => {
                var _a;
                return ({
                    status,
                    count: (_a = byStatus.get(status)) !== null && _a !== void 0 ? _a : 0,
                });
            });
        });
    }
    getTimeseries(user, input, interval) {
        return __awaiter(this, void 0, void 0, function* () {
            const sellerId = yield this.sellerIdFor(user);
            return dashboardRepository_1.dashboardRepository.timeseries(sellerId, this.range(input), interval);
        });
    }
    getByCategory(user, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const sellerId = yield this.sellerIdFor(user);
            return dashboardRepository_1.dashboardRepository.byCategory(sellerId, this.range(input));
        });
    }
    getTopProducts(user, input, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const sellerId = yield this.sellerIdFor(user);
            return dashboardRepository_1.dashboardRepository.topProducts(sellerId, this.range(input), limit);
        });
    }
    getNewCustomers(user, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const sellerId = yield this.sellerIdFor(user);
            return dashboardRepository_1.dashboardRepository.newCustomers(sellerId, this.range(input));
        });
    }
    getRatings(user) {
        return __awaiter(this, void 0, void 0, function* () {
            const sellerId = yield this.sellerIdFor(user);
            return reviewRepository_1.reviewRepository.reputation("seller", sellerId);
        });
    }
}
exports.DashboardService = DashboardService;
