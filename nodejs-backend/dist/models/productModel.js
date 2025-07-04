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
exports.ProductModel = exports.Category = void 0;
const db_1 = __importDefault(require("../config/db"));
var Category;
(function (Category) {
    Category["Office"] = "Office";
    Category["Sports"] = "Sports";
    Category["Books"] = "Books";
    Category["Beauty"] = "Beauty";
    Category["Clothing"] = "Clothing";
    Category["Toys"] = "Toys";
    Category["TvProjectors"] = "TvProjectors";
    Category["SmartphonesTablets"] = "SmartphonesTablets";
    Category["Eletronics"] = "Eletronics";
    Category["Pets"] = "Pets";
    Category["Furniture"] = "Furniture";
})(Category || (exports.Category = Category = {}));
class ProductModel {
    constructor(data = {}) {
        this.fill(data);
    }
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.create({
                data: {
                    sellerId: data.sellerId,
                    name: data.name,
                    description: data.description,
                    price: data.price,
                    stock: data.stock,
                    category: data.category,
                    image: data.image,
                },
            });
        });
    }
    static searchProducts(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.findMany({
                where: {
                    name: {
                        contains: query,
                        mode: "insensitive", // Case insensitive search
                    },
                },
                include: {
                    seller: {
                        select: {
                            storeName: true,
                        },
                    },
                },
                orderBy: {
                    name: "asc",
                },
            });
        });
    }
    static getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.findUnique({
                where: { id },
            });
        });
    }
    static getProductBySellerAndName(name, sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.findFirst({
                where: {
                    name,
                    sellerId,
                },
            });
        });
    }
    static getProductsBySeller(sellerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.findMany({
                where: {
                    sellerId,
                },
                include: {
                    seller: {
                        select: {
                            storeName: true,
                        },
                    },
                },
            });
        });
    }
    static getProductsByCategory(category) {
        return __awaiter(this, void 0, void 0, function* () {
            const products = yield db_1.default.product.findMany({
                where: {
                    category,
                },
                include: {
                    seller: {
                        select: {
                            storeName: true,
                        },
                    },
                },
            });
            const productsWithAvgRating = yield Promise.all(products.map((product) => __awaiter(this, void 0, void 0, function* () {
                const avg = yield db_1.default.review.aggregate({
                    where: { productId: product.id },
                    _avg: {
                        rating: true,
                    },
                });
                return Object.assign(Object.assign({}, product), { averageRating: avg._avg.rating
                        ? parseFloat(avg._avg.rating.toFixed(2))
                        : null });
            })));
            return productsWithAvgRating;
        });
    }
    static getProductsByIds(productIds) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.findMany({
                where: {
                    id: {
                        in: productIds,
                    },
                },
            });
        });
    }
    static getProductById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.findUnique({
                where: {
                    id,
                },
            });
        });
    }
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.update({
                where: { id },
                data,
            });
        });
    }
    static updateStock(productId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.update({
                where: { id: productId },
                data: { stock: { increment: quantity } },
            });
        });
    }
    static delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.delete({
                where: { id },
            });
        });
    }
    fill(data) {
        this.id = data.id !== undefined ? data.id : undefined;
        this.sellerId = data.sellerId !== undefined ? data.sellerId : undefined;
        this.name = data.name !== undefined ? data.name : undefined;
        this.description =
            data.description !== undefined ? data.description : undefined;
        this.price = data.price !== undefined ? data.price : undefined;
        this.stock = data.stock !== undefined ? data.stock : undefined;
        this.category = data.category !== undefined ? data.category : undefined;
        this.createdAt = data.createdAt !== undefined ? data.createdAt : undefined;
    }
}
exports.ProductModel = ProductModel;
