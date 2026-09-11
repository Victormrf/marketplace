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
exports.productRoutes = void 0;
const client_1 = require("@prisma/client");
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const uploadProductImage_1 = __importDefault(require("../middlewares/uploadProductImage"));
const productService_1 = require("../services/productService");
const productRead_1 = require("../types/productRead");
const customErrors_1 = require("../utils/customErrors");
exports.productRoutes = (0, express_1.Router)();
const productService = new productService_1.ProductService();
function readPagination(query) {
    try {
        return {
            page: (0, productRead_1.parsePaginationValue)(query.page, productRead_1.DEFAULT_PAGE, "page"),
            limit: (0, productRead_1.parsePaginationValue)(query.limit, productRead_1.DEFAULT_LIMIT, "limit"),
        };
    }
    catch (error) {
        throw new customErrors_1.ValidationError(error.message);
    }
}
function readCategory(value) {
    if (!Object.values(client_1.ProductCategory).includes(value)) {
        throw new customErrors_1.ValidationError("Invalid category");
    }
    return value;
}
function sendProductError(error, res) {
    if (error instanceof customErrors_1.ValidationError) {
        res.status(400).json({ error: error.message });
        return;
    }
    if (error instanceof productService_1.ProductForbiddenError) {
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
function inputWithUploadedImage(req) {
    return Object.assign(Object.assign({}, req.body), (req.file ? { image: req.file.path } : {}));
}
exports.productRoutes.post("/", authMiddleware_1.authMiddleware, uploadProductImage_1.default.single("image"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const product = yield productService.createProduct({ id: req.user.id, role: req.user.role }, inputWithUploadedImage(req));
        res.status(201).json(product);
    }
    catch (error) {
        sendProductError(error, res);
    }
}));
exports.productRoutes.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield productService.listProducts({}, readPagination(req.query)));
    }
    catch (error) {
        sendProductError(error, res);
    }
}));
exports.productRoutes.get("/search", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (typeof req.query.q !== "string")
            throw new customErrors_1.ValidationError("Invalid search query");
        res.status(200).json(yield productService.searchProductsRead(req.query.q, readPagination(req.query)));
    }
    catch (error) {
        sendProductError(error, res);
    }
}));
exports.productRoutes.get("/seller/:sellerId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield productService.getProductsReadBySeller(req.params.sellerId, readPagination(req.query)));
    }
    catch (error) {
        sendProductError(error, res);
    }
}));
exports.productRoutes.get("/category/:category", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield productService.getProductsReadByCategory(readCategory(req.params.category), readPagination(req.query)));
    }
    catch (error) {
        sendProductError(error, res);
    }
}));
exports.productRoutes.get("/:productIds", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ids = req.params.productIds.split(",");
        if (ids.length === 1) {
            res.status(200).json(yield productService.getProductReadById(ids[0]));
            return;
        }
        res.status(200).json(yield productService.getProductsReadByIds(ids, readPagination(req.query)));
    }
    catch (error) {
        sendProductError(error, res);
    }
}));
exports.productRoutes.put("/:productId", authMiddleware_1.authMiddleware, uploadProductImage_1.default.single("image"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const product = yield productService.updateProduct(req.params.productId, { id: req.user.id, role: req.user.role }, inputWithUploadedImage(req));
        res.status(200).json(product);
    }
    catch (error) {
        sendProductError(error, res);
    }
}));
exports.productRoutes.delete("/:productId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield productService.deactivateProduct(req.params.productId, {
            id: req.user.id,
            role: req.user.role,
        });
        res.status(204).send();
    }
    catch (error) {
        sendProductError(error, res);
    }
}));
