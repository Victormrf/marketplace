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
exports.cartRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const cartService_1 = require("../services/cartService");
const customErrors_1 = require("../utils/customErrors");
exports.cartRoutes = (0, express_1.Router)();
exports.cartRoutes.use(authMiddleware_1.authMiddleware);
function sendError(error, res) {
    if (error instanceof customErrors_1.ValidationError)
        return res.status(400).json({ error: error.message });
    if (error instanceof customErrors_1.ForbiddenError)
        return res.status(403).json({ error: error.message });
    if (error instanceof customErrors_1.ObjectNotFoundError)
        return res.status(404).json({ error: error.message });
    if (error instanceof customErrors_1.ConflictError)
        return res.status(409).json({ error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
}
function userId(req) { return req.user.id; }
exports.cartRoutes.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield cartService_1.cartService.getCart(userId(req)));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.cartRoutes.post("/items", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        res.status(201).json(yield cartService_1.cartService.addItem(userId(req), (_a = req.body) !== null && _a !== void 0 ? _a : {}));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.cartRoutes.put("/items/:productId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        res.status(200).json(yield cartService_1.cartService.updateItem(userId(req), req.params.productId, (_a = req.body) !== null && _a !== void 0 ? _a : {}));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.cartRoutes.delete("/items", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cartService_1.cartService.clear(userId(req));
        res.status(204).send();
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.cartRoutes.delete("/items/:productId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cartService_1.cartService.removeItem(userId(req), req.params.productId);
        res.status(204).send();
    }
    catch (error) {
        sendError(error, res);
    }
}));
