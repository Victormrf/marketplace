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
const reviewService_1 = require("../services/reviewService");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const customErrors_1 = require("../utils/customErrors");
exports.reviewRoutes = (0, express_1.Router)();
const reviewService = new reviewService_1.ReviewService();
exports.reviewRoutes.post("/product", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const requestorRole = req.user.role;
    const { productId, rating, comment } = req.body;
    if (requestorRole !== "CUSTOMER") {
        res.status(403).json({ error: "Only customers can send reviews." });
        return;
    }
    try {
        const review = yield reviewService.createProductReview(userId, {
            productId,
            rating,
            comment,
        });
        res.status(201).json(review);
    }
    catch (error) {
        if (error instanceof customErrors_1.ValidationError) {
            res.status(400).json({ error: error.message });
        }
        else if (error instanceof customErrors_1.ConflictError) {
            res.status(409).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}));
// Criar avaliação de um vendedor
exports.reviewRoutes.post("/seller", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const requestorRole = req.user.role;
    const { sellerId, rating, comment } = req.body;
    if (requestorRole !== "CUSTOMER") {
        res.status(403).json({ error: "Only customers can send reviews." });
        return;
    }
    try {
        const review = yield reviewService.createSellerReview(userId, {
            sellerId,
            rating,
            comment,
        });
        res.status(201).json(review);
    }
    catch (error) {
        if (error instanceof customErrors_1.ValidationError) {
            res.status(400).json({ error: error.message });
        }
        else if (error instanceof customErrors_1.ConflictError) {
            res.status(409).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}));
exports.reviewRoutes.get("/product/:productId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const reviews = yield reviewService.getProductReviews(req.params.productId);
        res.status(200).json(reviews);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}));
exports.reviewRoutes.get("/seller/:sellerId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const reviews = yield reviewService.getSellerReviews(req.params.sellerId);
        res.status(200).json(reviews);
    }
    catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
exports.reviewRoutes.put("/:reviewId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    try {
        const updated = yield reviewService.updateReview(reviewId, rating, comment);
        res.status(200).json(updated);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}));
exports.reviewRoutes.delete("/:reviewId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield reviewService.deleteReview(req.params.reviewId);
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
}));
