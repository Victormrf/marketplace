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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRepository = exports.ReviewRepository = void 0;
const db_1 = __importDefault(require("../config/db"));
const reviewSelect = {
    id: true,
    userId: true,
    productId: true,
    sellerId: true,
    rating: true,
    comment: true,
    createdAt: true,
    updatedAt: true,
};
function targetWhere(target, targetId, filters) {
    return Object.assign({ [target === "product" ? "productId" : "sellerId"]: targetId }, (filters.rating ? { rating: filters.rating } : {}));
}
class ReviewRepository {
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.review.findUnique({ where: { id }, select: reviewSelect });
        });
    }
    findByIdForAuthor(id, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.review.findFirst({
                where: { id, userId },
                select: reviewSelect,
            });
        });
    }
    productExists(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            return Boolean(yield db_1.default.product.findUnique({
                where: { id: productId },
                select: { id: true },
            }));
        });
    }
    sellerExists(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return Boolean(yield db_1.default.seller.findUnique({
                where: { id: sellerId },
                select: { id: true },
            }));
        });
    }
    hasDeliveredProductPurchase(customerId, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            return Boolean(yield db_1.default.orderItem.findFirst({
                where: {
                    productId,
                    sellerOrder: {
                        status: "DELIVERED",
                        order: { customerId },
                    },
                },
                select: { id: true },
            }));
        });
    }
    hasDeliveredSellerPurchase(customerId, sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return Boolean(yield db_1.default.sellerOrder.findFirst({
                where: {
                    sellerId,
                    status: "DELIVERED",
                    order: { customerId },
                },
                select: { id: true },
            }));
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.review.create({ data, select: reviewSelect });
        });
    }
    update(id, userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield db_1.default.review.updateMany({
                where: { id, userId },
                data,
            });
            if (result.count !== 1)
                return null;
            return this.findByIdForAuthor(id, userId);
        });
    }
    count(target, targetId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.review.count({ where: targetWhere(target, targetId, filters) });
        });
    }
    findMany(target, targetId, filters, skip, take) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.review.findMany({
                where: targetWhere(target, targetId, filters),
                select: reviewSelect,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip,
                take,
            });
        });
    }
    reputation(target, targetId) {
        return __awaiter(this, void 0, void 0, function* () {
            const rows = yield db_1.default.review.groupBy({
                by: ["rating"],
                where: targetWhere(target, targetId, {}),
                _count: { rating: true },
            });
            const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            for (const row of rows) {
                if (row.rating >= 1 && row.rating <= 5) {
                    distribution[row.rating] = row._count.rating;
                }
            }
            const totalReviews = Object.values(distribution).reduce((total, count) => total + count, 0);
            const ratingSum = Object.entries(distribution).reduce((total, [rating, count]) => total + Number(rating) * count, 0);
            return {
                averageRating: totalReviews === 0
                    ? null
                    : Number((ratingSum / totalReviews).toFixed(2)),
                totalReviews,
                distribution,
            };
        });
    }
    ratingDistributionBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const reputation = yield this.reputation("seller", sellerId);
            return [1, 2, 3, 4, 5].map((rating) => ({
                rating,
                count: reputation.distribution[rating],
            }));
        });
    }
}
exports.ReviewRepository = ReviewRepository;
exports.reviewRepository = new ReviewRepository();
