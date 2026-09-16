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
exports.checkoutRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const checkoutService_1 = require("../services/checkoutService");
const customErrors_1 = require("../utils/customErrors");
exports.checkoutRoutes = (0, express_1.Router)();
exports.checkoutRoutes.use(authMiddleware_1.authMiddleware);
exports.checkoutRoutes.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const execution = yield checkoutService_1.checkoutService.checkout(req.user.id, (_a = req.body) !== null && _a !== void 0 ? _a : {}, (_b = req.header("Idempotency-Key")) !== null && _b !== void 0 ? _b : "");
        if (execution.replayed)
            res.setHeader("Idempotency-Replayed", "true");
        res.status(execution.replayed ? 200 : 201).json(execution.result);
    }
    catch (error) {
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
        res.status(500).json({ message: "Internal Server Error" });
    }
}));
