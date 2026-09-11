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
exports.ProductService = exports.ProductForbiddenError = void 0;
const client_1 = require("@prisma/client");
const productRepository_1 = require("../repositories/productRepository");
const productRead_1 = require("../types/productRead");
const customErrors_1 = require("../utils/customErrors");
class ProductForbiddenError extends Error {
    constructor() {
        super("You do not have permission to modify this product");
        this.name = "ProductForbiddenError";
    }
}
exports.ProductForbiddenError = ProductForbiddenError;
const PRODUCT_WRITE_FIELDS = new Set([
    "name",
    "reference",
    "description",
    "priceInCents",
    "currency",
    "category",
    "image",
]);
function isUniqueViolation(error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
function normalizeRequiredString(value, field) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new customErrors_1.ValidationError(`${field} is required`);
    }
    return value.trim();
}
function normalizeOptionalString(value, field) {
    if (value === null || value === undefined)
        return null;
    if (typeof value !== "string")
        throw new customErrors_1.ValidationError(`${field} must be a string`);
    const normalized = value.trim();
    return normalized === "" ? null : normalized;
}
function parseNonNegativeInteger(value, field) {
    const parsed = typeof value === "number"
        ? value
        : typeof value === "string" && /^\d+$/.test(value.trim())
            ? Number(value.trim())
            : NaN;
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
        throw new customErrors_1.ValidationError(`${field} must be a non-negative integer`);
    }
    return parsed;
}
function validateCurrency(value) {
    if (value !== undefined && value !== "BRL") {
        throw new customErrors_1.ValidationError("Only BRL currency is supported");
    }
    return "BRL";
}
function validateCategory(value) {
    if (!Object.values(client_1.ProductCategory).includes(value)) {
        throw new customErrors_1.ValidationError("Invalid category");
    }
    return value;
}
function rejectUnknownFields(input) {
    const unknown = Object.keys(input).find((field) => !PRODUCT_WRITE_FIELDS.has(field));
    if (unknown)
        throw new customErrors_1.ValidationError(`Unsupported product field: ${unknown}`);
}
class ProductService {
    constructor(repository = productRepository_1.productRepository) {
        this.repository = repository;
    }
    toReadDto(product, ratings) {
        var _a, _b, _c, _d, _e;
        const onHandQuantity = (_b = (_a = product.inventory) === null || _a === void 0 ? void 0 : _a.onHandQuantity) !== null && _b !== void 0 ? _b : 0;
        const reservedQuantity = (_d = (_c = product.inventory) === null || _c === void 0 ? void 0 : _c.reservedQuantity) !== null && _d !== void 0 ? _d : 0;
        return {
            id: product.id,
            sellerId: product.sellerId,
            sellerName: product.seller.storeName,
            name: product.name,
            reference: product.reference,
            description: product.description,
            priceInCents: product.priceInCents,
            currency: "BRL",
            category: product.category,
            image: product.image,
            inventory: { onHandQuantity, reservedQuantity, availableQuantity: onHandQuantity - reservedQuantity },
            averageRating: (_e = ratings.get(product.id)) !== null && _e !== void 0 ? _e : null,
        };
    }
    readCollection(filters, pagination) {
        return __awaiter(this, void 0, void 0, function* () {
            const total = yield this.repository.count(filters);
            const products = yield this.repository.findMany(filters, (pagination.page - 1) * pagination.limit, pagination.limit);
            const ratings = yield this.repository.averageRatings(products.map((product) => product.id));
            return {
                data: products.map((product) => this.toReadDto(product, ratings)),
                pagination: { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) },
            };
        });
    }
    listProducts() {
        return __awaiter(this, arguments, void 0, function* (filters = {}, pagination = { page: productRead_1.DEFAULT_PAGE, limit: productRead_1.DEFAULT_LIMIT }) {
            return this.readCollection(filters, pagination);
        });
    }
    getProductReadById(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield this.repository.findById(productId);
            if (!product)
                throw new customErrors_1.ObjectNotFoundError("product");
            return this.toReadDto(product, yield this.repository.averageRatings([product.id]));
        });
    }
    getProductsReadByIds(productIds, pagination) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!productIds.length)
                throw new customErrors_1.ValidationError("No product id was informed.");
            return this.readCollection({ ids: productIds }, pagination);
        });
    }
    searchProductsRead(searchQuery, pagination) {
        return __awaiter(this, void 0, void 0, function* () {
            const search = searchQuery.trim();
            if (!search)
                throw new customErrors_1.ValidationError("Search query cannot be empty");
            return this.readCollection({ search }, pagination);
        });
    }
    getProductsReadByCategory(category, pagination) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!category)
                throw new customErrors_1.ValidationError("Invalid category");
            return this.readCollection({ category }, pagination);
        });
    }
    getProductsReadBySeller(sellerId, pagination) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.readCollection({ sellerId }, pagination);
        });
    }
    assertCanManage(productId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield this.repository.findForAuthorization(productId);
            if (!product || !product.isActive)
                throw new customErrors_1.ObjectNotFoundError("Product");
            if (actor.role === "ADMIN")
                return product;
            if (actor.role !== "SELLER")
                throw new ProductForbiddenError();
            const seller = yield this.repository.findActiveSellerByUserId(actor.id);
            if (!seller || seller.id !== product.sellerId)
                throw new ProductForbiddenError();
            return product;
        });
    }
    createProduct(actor, input) {
        return __awaiter(this, void 0, void 0, function* () {
            rejectUnknownFields(input);
            const seller = actor.role === "SELLER" ? yield this.repository.findActiveSellerByUserId(actor.id) : null;
            if (actor.role !== "SELLER" || !seller)
                throw new ProductForbiddenError();
            const data = {
                sellerId: seller.id,
                name: normalizeRequiredString(input.name, "name"),
                reference: normalizeOptionalString(input.reference, "reference"),
                description: normalizeOptionalString(input.description, "description"),
                priceInCents: parseNonNegativeInteger(input.priceInCents, "priceInCents"),
                currency: validateCurrency(input.currency),
                category: validateCategory(input.category),
                image: normalizeOptionalString(input.image, "image"),
            };
            try {
                const created = yield this.repository.createWithInventory(data);
                return this.getProductReadById(created.id);
            }
            catch (error) {
                if (isUniqueViolation(error))
                    throw new customErrors_1.ConflictError("Product reference already exists for this seller");
                throw error;
            }
        });
    }
    updateProduct(productId, actor, input) {
        return __awaiter(this, void 0, void 0, function* () {
            rejectUnknownFields(input);
            if (Object.keys(input).length === 0)
                throw new customErrors_1.ValidationError("No fields to update");
            yield this.assertCanManage(productId, actor);
            const data = {};
            if ("name" in input)
                data.name = normalizeRequiredString(input.name, "name");
            if ("reference" in input)
                data.reference = normalizeOptionalString(input.reference, "reference");
            if ("description" in input)
                data.description = normalizeOptionalString(input.description, "description");
            if ("priceInCents" in input)
                data.priceInCents = parseNonNegativeInteger(input.priceInCents, "priceInCents");
            if ("currency" in input)
                data.currency = validateCurrency(input.currency);
            if ("category" in input)
                data.category = validateCategory(input.category);
            if ("image" in input)
                data.image = normalizeOptionalString(input.image, "image");
            try {
                yield this.repository.updateProduct(productId, data);
                return this.getProductReadById(productId);
            }
            catch (error) {
                if (isUniqueViolation(error))
                    throw new customErrors_1.ConflictError("Product reference already exists for this seller");
                throw error;
            }
        });
    }
    deactivateProduct(productId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield this.repository.findForAuthorization(productId);
            if (!product)
                throw new customErrors_1.ObjectNotFoundError("Product");
            if (!product.isActive)
                return;
            yield this.assertCanManage(productId, actor);
            yield this.repository.deactivateProduct(productId, new Date());
        });
    }
}
exports.ProductService = ProductService;
