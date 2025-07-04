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
exports.cartItemRoutes = void 0;
const express_1 = require("express");
const cartItemService_1 = require("../services/cartItemService");
const customErrors_1 = require("../utils/customErrors");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
exports.cartItemRoutes = (0, express_1.Router)();
const cartItemService = new cartItemService_1.CartItemService();
exports.cartItemRoutes.post("/", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("CUSTOMER"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productId, quantity } = req.body;
    const userId = req.user.id;
    try {
        const item = yield cartItemService.addToCart({
            userId,
            productId,
            quantity,
        });
        res.status(201).json(item);
    }
    catch (error) {
        if (error instanceof customErrors_1.ValidationError) {
            res.status(400).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    }
}));
exports.cartItemRoutes.get("/", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("CUSTOMER"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    try {
        const items = yield cartItemService.getUserCart(userId);
        res.status(200).json(items);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    }
}));
exports.cartItemRoutes.put("/product/:productId", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("CUSTOMER"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productId } = req.params;
    const { quantity } = req.body;
    try {
        const updated = yield cartItemService.updateQuantity(productId, quantity);
        res.status(200).json(updated);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    }
}));
exports.cartItemRoutes.delete("/product/:productId", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("CUSTOMER"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productId } = req.params;
    try {
        yield cartItemService.removeProductFromCart(productId);
        res.sendStatus(204);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    }
}));
exports.cartItemRoutes.delete("/clear", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("CUSTOMER"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    try {
        yield cartItemService.clearUserCart(userId);
        res.sendStatus(204);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    }
}));
exports.cartItemRoutes.delete("/:id", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("CUSTOMER"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        yield cartItemService.removeFromCart(id);
        res.sendStatus(204);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    }
}));
