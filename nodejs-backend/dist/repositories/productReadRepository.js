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
exports.productReadRepository = exports.ProductReadRepository = void 0;
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
    return Object.assign(Object.assign(Object.assign(Object.assign({ isActive: true, seller: { isActive: true } }, (filters.search
        ? { name: { contains: filters.search, mode: "insensitive" } }
        : {})), (filters.category ? { category: filters.category } : {})), (filters.sellerId ? { sellerId: filters.sellerId } : {})), (filters.ids ? { id: { in: filters.ids } } : {}));
}
class ProductReadRepository {
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
                where: Object.assign(Object.assign({}, buildWhere({})), { id }),
                select: PRODUCT_READ_SELECT,
            });
        });
    }
    averageRatings(productIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (productIds.length === 0)
                return new Map();
            const grouped = (yield db_1.default.review.groupBy({
                by: ["productId"],
                where: { productId: { in: productIds } },
                _avg: { rating: true },
            }));
            return new Map(grouped
                .filter((row) => row.productId !== null && row._avg.rating !== null)
                .map((row) => [row.productId, Number(row._avg.rating.toFixed(2))]));
        });
    }
}
exports.ProductReadRepository = ProductReadRepository;
exports.productReadRepository = new ProductReadRepository();
