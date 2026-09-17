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
exports.reviewRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const reviewService_1 = require("../services/reviewService");
const customErrors_1 = require("../utils/customErrors");
exports.reviewRoutes = (0, express_1.Router)();
const reviewService = new reviewService_1.ReviewService();
function parseBody(body) {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        throw new customErrors_1.ValidationError("Invalid request body");
    }
    return body;
}
function reviewInput(body) {
    const data = parseBody(body);
    const allowed = new Set(["rating", "comment"]);
    const unknown = Object.keys(data).find((key) => !allowed.has(key));
    if (unknown)
        throw new customErrors_1.ValidationError(`Unsupported review field: ${unknown}`);
    if (!("rating" in data))
        throw new customErrors_1.ValidationError("rating is required");
    return {
        rating: data.rating,
        comment: data.comment,
    };
}
function reviewUpdateInput(body) {
    const data = parseBody(body);
    const allowed = new Set(["rating", "comment"]);
    const unknown = Object.keys(data).find((key) => !allowed.has(key));
    if (unknown)
        throw new customErrors_1.ValidationError(`Unsupported review field: ${unknown}`);
    if (!Object.keys(data).length)
        throw new customErrors_1.ValidationError("Empty review update");
    return Object.assign(Object.assign({}, (Object.prototype.hasOwnProperty.call(data, "rating")
        ? { rating: data.rating }
        : {})), (Object.prototype.hasOwnProperty.call(data, "comment")
        ? { comment: data.comment }
        : {}));
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
function filters(query) {
    if (query.rating === undefined)
        return {};
    const rating = Number(query.rating);
    if (!Number.isSafeInteger(rating) || rating < 1 || rating > 5) {
        throw new customErrors_1.ValidationError("Invalid rating filter");
    }
    return { rating };
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
    if (error instanceof customErrors_1.ObjectNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
    }
    if (error instanceof customErrors_1.ConflictError) {
        res.status(409).json({ error: error.message });
        return;
    }
    res.status(500).json({ error: "Internal Server Error" });
}
exports.reviewRoutes.post("/products/:productId/reviews", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(201).json(yield reviewService.createProductReview(req.user, req.params.productId, reviewInput(req.body)));
    }
    catch (error) {
        handleError(error, res);
    }
}));
exports.reviewRoutes.get("/products/:productId/reviews", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield reviewService.list("product", req.params.productId, filters(req.query), pagination(req.query)));
    }
    catch (error) {
        handleError(error, res);
    }
}));
exports.reviewRoutes.post("/sellers/:sellerId/reviews", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(201).json(yield reviewService.createSellerReview(req.user, req.params.sellerId, reviewInput(req.body)));
    }
    catch (error) {
        handleError(error, res);
    }
}));
exports.reviewRoutes.get("/sellers/:sellerId/reviews", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield reviewService.list("seller", req.params.sellerId, filters(req.query), pagination(req.query)));
    }
    catch (error) {
        handleError(error, res);
    }
}));
exports.reviewRoutes.get("/reviews/:reviewId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield reviewService.get(req.params.reviewId));
    }
    catch (error) {
        handleError(error, res);
    }
}));
exports.reviewRoutes.patch("/reviews/:reviewId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield reviewService.update(req.user, req.params.reviewId, reviewUpdateInput(req.body)));
    }
    catch (error) {
        handleError(error, res);
    }
}));
