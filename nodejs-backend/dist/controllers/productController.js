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
const express_1 = require("express");
const productService_1 = require("../services/productService");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const customErrors_1 = require("../utils/customErrors");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
const uploadProductImage_1 = __importDefault(require("../middlewares/uploadProductImage"));
exports.productRoutes = (0, express_1.Router)();
const productService = new productService_1.ProductService();
exports.productRoutes.post("/", authMiddleware_1.authMiddleware, uploadProductImage_1.default.single("image"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { sellerId, name, description, price, stock, category } = req.body;
    // A imagem processada pelo Cloudinary já retorna a URL pública em req.file.path
    const imageUrl = ((_a = req.file) === null || _a === void 0 ? void 0 : _a.path) || null;
    try {
        const newProductListing = yield productService.createOrRestockProduct({
            sellerId,
            name,
            description,
            price: parseFloat(price),
            stock: parseInt(stock),
            category,
            image: imageUrl,
        });
        res.status(201).json(newProductListing);
    }
    catch (error) {
        if (error instanceof Error) {
            console.error("Erro ao criar produto:", error.message);
            console.error("Stack:", error.stack);
        }
        else if (error instanceof customErrors_1.ValidationError) {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(500).json({
                message: "Erro interno ao criar produto",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}));
exports.productRoutes.get("/search", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { q: searchQuery } = req.query;
    try {
        if (typeof searchQuery !== "string") {
            res.status(400).json({ error: "Invalid search query" });
            return;
        }
        const products = yield productService.searchProducts(searchQuery);
        res.status(200).json({ products });
    }
    catch (error) {
        if (error instanceof customErrors_1.ValidationError) {
            res.status(400).json({ error: error.message });
        }
        else if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
}));
exports.productRoutes.get("/:productIds", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productIds } = req.params;
    const idsArray = productIds.split(",");
    try {
        const products = yield productService.getProductsByIds(idsArray);
        res.status(200).json({ products });
    }
    catch (error) {
        if (error instanceof customErrors_1.ValidationError) {
            res.status(400).json({ error: error.message });
            return;
        }
        else if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    }
}));
exports.productRoutes.get("/seller/:sellerId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { sellerId } = req.params;
    try {
        const products = yield productService.getProductsBySellerId(sellerId);
        res.status(200).json({ products });
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    }
}));
exports.productRoutes.get("/category/:category", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { category } = req.params;
    try {
        const products = yield productService.getProductsByCategory(category);
        res.status(200).json({ products });
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectsNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
            return;
        }
    }
}));
exports.productRoutes.put("/:productId", authMiddleware_1.authMiddleware, uploadProductImage_1.default.single("image"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const requestorRole = req.user.role;
    const { productId } = req.params;
    const updateData = req.body;
    if (requestorRole !== "ADMIN" && requestorRole !== "SELLER") {
        res.status(403).json({ error: "Access denied." });
        return;
    }
    if (!updateData || Object.keys(updateData).length === 0) {
        res.status(400).json({ error: "No fields to update" });
        return;
    }
    // Se imagem foi enviada, adiciona URL ao updateData
    if (req.file) {
        updateData.image = req.file.path;
    }
    try {
        const updatedProduct = yield productService.updateProduct(productId, updateData);
        res.status(200).json(updatedProduct);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
exports.productRoutes.delete("/:productId", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("admin"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productId } = req.params;
    try {
        yield productService.deleteProduct(productId);
        res.status(204).json({ message: "Product was successfully deleted" });
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: error });
        return;
    }
}));
