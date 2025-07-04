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
exports.ProductService = void 0;
const productModel_1 = require("../models/productModel");
const customErrors_1 = require("../utils/customErrors");
class ProductService {
    createOrRestockProduct(productData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!productData.sellerId ||
                !productData.name ||
                productData.price === undefined ||
                productData.stock === undefined ||
                !productData.category) {
                throw new customErrors_1.ValidationError("Missing required fields");
            }
            const existingProduct = yield productModel_1.ProductModel.getProductBySellerAndName(productData.name, productData.sellerId);
            if (existingProduct && existingProduct.id) {
                return yield this.restock(existingProduct.id, productData.stock);
            }
            return yield productModel_1.ProductModel.create(productData);
        });
    }
    restock(productId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield productModel_1.ProductModel.getById(productId);
            if (!product) {
                throw new customErrors_1.ObjectNotFoundError("Product");
            }
            if (product.stock === undefined) {
                throw new customErrors_1.ValidationError("Product stock is not initialized");
            }
            const newStock = product.stock + quantity;
            if (newStock < 0) {
                throw new customErrors_1.ValidationError("Stock cannot be negative");
            }
            return yield productModel_1.ProductModel.updateStock(productId, quantity);
        });
    }
    searchProducts(searchQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!searchQuery || searchQuery.trim().length === 0) {
                throw new customErrors_1.ValidationError("Search query cannot be empty");
            }
            const products = yield productModel_1.ProductModel.searchProducts(searchQuery.trim());
            if (!products.length) {
                throw new customErrors_1.ObjectsNotFoundError("No products found matching your search");
            }
            return products;
        });
    }
    getProductById(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield productModel_1.ProductModel.getProductById(productId);
            if (!product) {
                throw new customErrors_1.ObjectNotFoundError("product");
            }
            return product;
        });
    }
    getProductsByIds(productIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!productIds || !productIds.length) {
                throw new customErrors_1.ValidationError("No product id was informed.");
            }
            const products = yield productModel_1.ProductModel.getProductsByIds(productIds);
            if (!products || !products.length) {
                throw new customErrors_1.ObjectsNotFoundError("products");
            }
            return products;
        });
    }
    getProductsBySellerId(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield productModel_1.ProductModel.getProductsBySeller(sellerId);
        });
    }
    getProductsByCategory(category) {
        return __awaiter(this, void 0, void 0, function* () {
            const products = yield productModel_1.ProductModel.getProductsByCategory(category);
            if (!products.length) {
                throw new customErrors_1.ObjectsNotFoundError("Products");
            }
            return products;
        });
    }
    updateProduct(productId, productData) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield productModel_1.ProductModel.getById(productId);
            if (!product) {
                throw new customErrors_1.ObjectNotFoundError("Product");
            }
            try {
                return yield productModel_1.ProductModel.update(productId, productData);
            }
            catch (error) {
                throw new Error(`Failed to update product: ${error.message}`);
            }
        });
    }
    deleteProduct(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield productModel_1.ProductModel.getById(productId);
            if (!product) {
                throw new customErrors_1.ObjectNotFoundError("Product");
            }
            return yield productModel_1.ProductModel.delete(productId);
        });
    }
}
exports.ProductService = ProductService;
