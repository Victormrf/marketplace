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
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const customerRepository_1 = require("../repositories/customerRepository");
const reviewRepository_1 = require("../repositories/reviewRepository");
const customErrors_1 = require("../utils/customErrors");
const MAX_COMMENT_LENGTH = 2000;
function toDto(record) {
    return {
        id: record.id,
        productId: record.productId,
        sellerId: record.sellerId,
        rating: record.rating,
        comment: record.comment,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}
function normalizeInput(input, requireRating = true) {
    if (input.rating === undefined) {
        if (requireRating) {
            throw new customErrors_1.ValidationError("rating is required");
        }
    }
    else if (!Number.isSafeInteger(input.rating) ||
        input.rating < 1 ||
        input.rating > 5) {
        throw new customErrors_1.ValidationError("rating must be an integer between 1 and 5");
    }
    if (!Object.prototype.hasOwnProperty.call(input, "comment")) {
        return input;
    }
    if (input.comment === null) {
        return Object.assign(Object.assign({}, input), { comment: null });
    }
    if (typeof input.comment !== "string") {
        throw new customErrors_1.ValidationError("comment must be a string");
    }
    const comment = input.comment.trim();
    if (comment.length > MAX_COMMENT_LENGTH) {
        throw new customErrors_1.ValidationError("comment is too long");
    }
    return Object.assign(Object.assign({}, input), { comment: comment || null });
}
function duplicateReviewError(target) {
    return new customErrors_1.ConflictError(target === "product"
        ? "This product has already received a review from you."
        : "This seller has already received a review from you.");
}
class ReviewService {
    constructor(repository = reviewRepository_1.reviewRepository) {
        this.repository = repository;
    }
    requireCustomer(user) {
        return __awaiter(this, void 0, void 0, function* () {
            if (user.role !== client_1.UserRole.CUSTOMER)
                throw new customErrors_1.ForbiddenError();
            const customer = yield customerRepository_1.customerRepository.findByUserId(user.id);
            if (!customer)
                throw new customErrors_1.ForbiddenError();
            return customer.id;
        });
    }
    create(user, target, targetId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const customerId = yield this.requireCustomer(user);
            const normalized = normalizeInput(input);
            const exists = target === "product"
                ? yield this.repository.productExists(targetId)
                : yield this.repository.sellerExists(targetId);
            if (!exists) {
                throw new customErrors_1.ObjectNotFoundError(target === "product" ? "Product" : "Seller");
            }
            const purchased = target === "product"
                ? yield this.repository.hasDeliveredProductPurchase(customerId, targetId)
                : yield this.repository.hasDeliveredSellerPurchase(customerId, targetId);
            if (!purchased) {
                throw new customErrors_1.ForbiddenError("A delivered purchase is required");
            }
            try {
                const record = yield this.repository.create(Object.assign(Object.assign({ userId: user.id }, (target === "product"
                    ? { productId: targetId }
                    : { sellerId: targetId })), { rating: normalized.rating, comment: (_a = normalized.comment) !== null && _a !== void 0 ? _a : null }));
                return toDto(record);
            }
            catch (error) {
                if (error instanceof library_1.PrismaClientKnownRequestError &&
                    error.code === "P2002") {
                    throw duplicateReviewError(target);
                }
                throw error;
            }
        });
    }
    createProductReview(user, productId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.create(user, "product", productId, input);
        });
    }
    createSellerReview(user, sellerId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.create(user, "seller", sellerId, input);
        });
    }
    list(target, targetId, filters, pagination) {
        return __awaiter(this, void 0, void 0, function* () {
            const total = yield this.repository.count(target, targetId, filters);
            const records = yield this.repository.findMany(target, targetId, filters, (pagination.page - 1) * pagination.limit, pagination.limit);
            const reputation = yield this.repository.reputation(target, targetId);
            return {
                data: records.map(toDto),
                pagination: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total,
                    totalPages: Math.ceil(total / pagination.limit),
                },
                reputation,
            };
        });
    }
    get(reviewId) {
        return __awaiter(this, void 0, void 0, function* () {
            const record = yield this.repository.findById(reviewId);
            if (!record)
                throw new customErrors_1.ObjectNotFoundError("Review");
            return toDto(record);
        });
    }
    update(user, reviewId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield this.repository.findById(reviewId);
            if (!existing)
                throw new customErrors_1.ObjectNotFoundError("Review");
            if (existing.userId !== user.id)
                throw new customErrors_1.ForbiddenError();
            const normalized = normalizeInput(input, false);
            const updated = yield this.repository.update(reviewId, user.id, Object.assign(Object.assign({}, (normalized.rating === undefined
                ? {}
                : { rating: normalized.rating })), (normalized.comment === undefined
                ? {}
                : { comment: normalized.comment })));
            if (!updated)
                throw new customErrors_1.ObjectNotFoundError("Review");
            return toDto(updated);
        });
    }
}
exports.ReviewService = ReviewService;
