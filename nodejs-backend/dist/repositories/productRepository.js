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
exports.productRepository = exports.ProductRepository = void 0;
const db_1 = __importDefault(require("../config/db"));
const PRODUCT_READ_SELECT = {
    id: true,
    sellerId: true,
    name: true,
    reference: true,
    description: true,
    priceInCents: true,
    currency: true,
    category: true,
    image: true,
    createdAt: true,
    seller: { select: { storeName: true } },
    inventory: { select: { onHandQuantity: true, reservedQuantity: true } },
};
function buildWhere(filters) {
    const and = [{
            isActive: true,
            seller: { isActive: true },
        }];
    if (filters.search) {
        and.push({ name: { contains: filters.search, mode: "insensitive" } });
    }
    if (filters.category) {
        and.push({ category: filters.category });
    }
    if (filters.sellerId) {
        and.push({ sellerId: filters.sellerId });
    }
    if (filters.ids) {
        and.push({ id: { in: filters.ids } });
    }
    if (filters.inStock === true) {
        and.push({
            inventory: {
                is: {
                    onHandQuantity: { gt: db_1.default.inventory.fields.reservedQuantity },
                },
            },
        });
    }
    else if (filters.inStock === false) {
        and.push({
            OR: [
                { inventory: { is: null } },
                {
                    inventory: {
                        is: {
                            onHandQuantity: { lte: db_1.default.inventory.fields.reservedQuantity },
                        },
                    },
                },
            ],
        });
    }
    return { AND: and };
}
class ProductRepository {
    count(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.count({ where: buildWhere(filters) });
        });
    }
    findMany(filters, skip, take) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.findMany({
                where: buildWhere(filters),
                select: PRODUCT_READ_SELECT,
                orderBy: [{ createdAt: "desc" }, { id: "asc" }],
                skip,
                take,
            });
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.findFirst({
                where: { AND: [buildWhere({}), { id }] },
                select: PRODUCT_READ_SELECT,
            });
        });
    }
    averageRatings(productIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (productIds.length === 0)
                return new Map();
            const grouped = yield db_1.default.review.groupBy({
                by: ["productId"],
                where: { productId: { in: productIds } },
                _avg: { rating: true },
            });
            return new Map(grouped
                .filter((row) => row.productId !== null && row._avg.rating !== null)
                .map((row) => [row.productId, Number(row._avg.rating.toFixed(2))]));
        });
    }
    findActiveSellerByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.seller.findFirst({
                where: { userId, isActive: true },
                select: { id: true },
            });
        });
    }
    findForAuthorization(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.findUnique({
                where: { id },
                select: { id: true, sellerId: true, isActive: true },
            });
        });
    }
    createWithInventory(data_1) {
        return __awaiter(this, arguments, void 0, function* (data, initialInventory = { onHandQuantity: 0, reservedQuantity: 0 }) {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const product = yield tx.product.create({
                    data: {
                        sellerId: data.sellerId,
                        name: data.name,
                        reference: data.reference,
                        description: data.description,
                        priceInCents: data.priceInCents,
                        currency: data.currency,
                        category: data.category,
                        image: data.image,
                    },
                    select: { id: true },
                });
                yield tx.inventory.create({
                    data: {
                        productId: product.id,
                        onHandQuantity: initialInventory.onHandQuantity,
                        reservedQuantity: initialInventory.reservedQuantity,
                    },
                });
                return product;
            }));
        });
    }
    updateProduct(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.update({ where: { id }, data, select: { id: true } });
        });
    }
    deactivateProduct(id, deactivatedAt) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.product.update({
                where: { id },
                data: { isActive: false, deactivatedAt },
                select: { id: true },
            });
        });
    }
    getProductsByIds(productIds) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.findMany({ ids: productIds }, 0, productIds.length);
        });
    }
}
exports.ProductRepository = ProductRepository;
exports.productRepository = new ProductRepository();
