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
exports.ReviewService = void 0;
const library_1 = require("@prisma/client/runtime/library");
const reviewModel_1 = require("../models/reviewModel");
const customErrors_1 = require("../utils/customErrors");
class ReviewService {
    createProductReview(userId, reviewData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { productId, rating, comment } = reviewData;
            if (!productId || rating === undefined) {
                throw new customErrors_1.ValidationError("Missing required fields for product review.");
            }
            try {
                return yield reviewModel_1.ReviewModel.create({
                    userId,
                    productId,
                    rating,
                    comment,
                });
            }
            catch (error) {
                if (error instanceof library_1.PrismaClientKnownRequestError &&
                    error.code === "P2002") {
                    throw new customErrors_1.ConflictError("This product has already received a review from you.");
                }
            }
        });
    }
    createSellerReview(userId, reviewData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { sellerId, rating, comment } = reviewData;
            if (!sellerId || rating === undefined) {
                throw new customErrors_1.ValidationError("Missing required fields for seller review.");
            }
            try {
                return yield reviewModel_1.ReviewModel.create({
                    userId,
                    sellerId,
                    rating,
                    comment,
                });
            }
            catch (error) {
                if (error instanceof library_1.PrismaClientKnownRequestError &&
                    error.code === "P2002") {
                    throw new customErrors_1.ConflictError("This seller has already received a review from you.");
                }
            }
        });
    }
    getProductReviews(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield reviewModel_1.ReviewModel.getByProduct(productId);
            if (!data.reviews.length) {
                throw new customErrors_1.ObjectsNotFoundError("reviews");
            }
            return data;
        });
    }
    getSellerReviews(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield reviewModel_1.ReviewModel.getBySeller(sellerId);
        });
    }
    updateReview(reviewId, rating, comment) {
        return __awaiter(this, void 0, void 0, function* () {
            const updateData = {};
            if (rating !== undefined)
                updateData.rating = rating;
            if (comment !== undefined)
                updateData.comment = comment;
            return yield reviewModel_1.ReviewModel.updateReview(reviewId, updateData);
        });
    }
    deleteReview(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const review = yield reviewModel_1.ReviewModel.getById(id);
            if (!review) {
                throw new customErrors_1.ObjectNotFoundError("review");
            }
            return yield reviewModel_1.ReviewModel.deleteReview(id);
        });
    }
}
exports.ReviewService = ReviewService;
