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
exports.ReviewModel = void 0;
const db_1 = __importDefault(require("../config/db"));
const removeNullFields_1 = require("../utils/removeNullFields");
class ReviewModel {
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const review = yield db_1.default.review.create({ data });
            return (0, removeNullFields_1.removeNullFields)(review);
        });
    }
    static getById(reviewId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.review.findUnique({ where: { id: reviewId } });
        });
    }
    static getByProduct(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const reviews = yield db_1.default.review.findMany({
                where: { productId },
                orderBy: { createdAt: "desc" },
            });
            const filteredReviews = (0, removeNullFields_1.removeNullFieldsFromArray)(reviews);
            const averageRating = filteredReviews.reduce((acc, curr) => acc + curr.rating, 0) /
                filteredReviews.length || 0;
            return {
                averageRating: parseFloat(averageRating.toFixed(2)),
                reviews: filteredReviews,
            };
        });
    }
    static getBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const reviews = yield db_1.default.review.findMany({
                where: { sellerId },
                orderBy: { createdAt: "desc" },
            });
            const filteredReviews = (0, removeNullFields_1.removeNullFieldsFromArray)(reviews);
            const averageRating = filteredReviews.reduce((acc, curr) => acc + curr.rating, 0) /
                filteredReviews.length || 0;
            return {
                averageRating: parseFloat(averageRating.toFixed(2)),
                reviews: filteredReviews,
            };
        });
    }
    static getRatingDistributionBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield db_1.default.review.groupBy({
                by: ["rating"],
                where: {
                    product: {
                        sellerId: sellerId, // passado como parâmetro
                    },
                },
                _count: {
                    rating: true,
                },
            });
            return [1, 2, 3, 4, 5].map((rating) => {
                const found = result.find((r) => r.rating === rating);
                return {
                    rating,
                    count: found ? found._count.rating : 0,
                };
            });
        });
    }
    static updateReview(reviewId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.review.update({
                where: { id: reviewId },
                data,
            });
        });
    }
    static deleteReview(reviewId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.review.delete({ where: { id: reviewId } });
        });
    }
}
exports.ReviewModel = ReviewModel;
