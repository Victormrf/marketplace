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
exports.readCatalogFilters = readCatalogFilters;
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
function readOptionalString(query, field) {
    const value = query[field];
    if (value === undefined)
        return undefined;
    if (typeof value !== "string" || value.trim() === "") {
        throw new customErrors_1.ValidationError(`Invalid ${field}`);
    }
    return value.trim();
}
function readInStock(query) {
    const value = query.inStock;
    if (value === undefined)
        return undefined;
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    throw new customErrors_1.ValidationError("Invalid inStock");
}
function readCatalogFilters(query, overrides = {}) {
    var _a, _b, _c;
    const search = overrides.search !== undefined
        ? readOptionalString({ search: overrides.search }, "search")
        : readOptionalString(query, "search");
    const sellerId = (_a = overrides.sellerId) !== null && _a !== void 0 ? _a : readOptionalString(query, "sellerId");
    const categoryValue = (_b = overrides.category) !== null && _b !== void 0 ? _b : readOptionalString(query, "category");
    const category = typeof categoryValue === "string" ? readCategory(categoryValue) : categoryValue;
    const inStock = (_c = overrides.inStock) !== null && _c !== void 0 ? _c : readInStock(query);
    return Object.assign(Object.assign(Object.assign(Object.assign({}, (search ? { search } : {})), (sellerId ? { sellerId } : {})), (category ? { category } : {})), (inStock !== undefined ? { inStock } : {}));
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
        res.status(200).json(yield productService.listProducts(readCatalogFilters(req.query), readPagination(req.query)));
    }
    catch (error) {
        sendProductError(error, res);
    }
}));
exports.productRoutes.get("/search", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (typeof req.query.q !== "string")
            throw new customErrors_1.ValidationError("Invalid search query");
        res.status(200).json(yield productService.listProducts(readCatalogFilters(req.query, { search: req.query.q }), readPagination(req.query)));
    }
    catch (error) {
        sendProductError(error, res);
    }
}));
exports.productRoutes.get("/seller/:sellerId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield productService.listProducts(readCatalogFilters(req.query, { sellerId: req.params.sellerId }), readPagination(req.query)));
    }
    catch (error) {
        sendProductError(error, res);
    }
}));
exports.productRoutes.get("/category/:category", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield productService.listProducts(readCatalogFilters(req.query, { category: readCategory(req.params.category) }), readPagination(req.query)));
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
