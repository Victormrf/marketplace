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
exports.inventoryRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const productRead_1 = require("../types/productRead");
const inventoryService_1 = require("../services/inventoryService");
const customErrors_1 = require("../utils/customErrors");
exports.inventoryRoutes = (0, express_1.Router)();
const service = new inventoryService_1.InventoryService();
function pagination(query) {
    return {
        page: (0, productRead_1.parsePaginationValue)(query.page, productRead_1.DEFAULT_PAGE, "page"),
        limit: (0, productRead_1.parsePaginationValue)(query.limit, productRead_1.DEFAULT_LIMIT, "limit"),
    };
}
function actor(req) {
    return { id: req.user.id, role: req.user.role };
}
function sendError(error, res) {
    if (error instanceof customErrors_1.ValidationError)
        return res.status(400).json({ error: error.message });
    if (error instanceof inventoryService_1.InventoryForbiddenError)
        return res.status(403).json({ error: error.message });
    if (error instanceof customErrors_1.ObjectNotFoundError)
        return res.status(404).json({ error: error.message });
    if (error instanceof customErrors_1.ConflictError)
        return res.status(409).json({ error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
}
exports.inventoryRoutes.use(authMiddleware_1.authMiddleware);
exports.inventoryRoutes.get("/products/:productId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(200)
            .json(yield service.getInventory(req.params.productId, actor(req)));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.inventoryRoutes.get("/products/:productId/movements", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(200)
            .json(yield service.listMovements(req.params.productId, actor(req), pagination(req.query)));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.inventoryRoutes.post("/products/:productId/restock", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(200)
            .json(yield service.restock(req.params.productId, actor(req), req.body));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.inventoryRoutes.post("/products/:productId/adjustments", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(200)
            .json(yield service.adjust(req.params.productId, actor(req), req.body));
    }
    catch (error) {
        sendError(error, res);
    }
}));
