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
exports.sellerRepository = exports.SellerRepository = void 0;
const db_1 = __importDefault(require("../config/db"));
const userRepository_1 = require("./userRepository");
const SELLER_SELECT = {
    id: true,
    userId: true,
    storeName: true,
    logo: true,
    description: true,
    isActive: true,
};
const SELLER_WITH_USER_SELECT = Object.assign(Object.assign({}, SELLER_SELECT), { user: { select: userRepository_1.USER_SAFE_SELECT } });
const SELLER_DEACTIVATION_SELECT = Object.assign(Object.assign({}, SELLER_SELECT), { deactivatedAt: true });
class SellerRepository {
    findByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.seller.findUnique({ where: { userId }, select: SELLER_SELECT });
        });
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.seller.findMany({
                select: SELLER_WITH_USER_SELECT,
                orderBy: { createdAt: "desc" },
            });
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.seller.create({ data, select: SELLER_SELECT });
        });
    }
    update(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.seller.update({ where: { userId }, data, select: SELLER_SELECT });
        });
    }
    findForDeactivation(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.seller.findUnique({ where: { userId }, select: SELLER_DEACTIVATION_SELECT });
        });
    }
    deactivate(record, deactivationTime) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db_1.default.seller.updateMany({
                where: { id: record.id, isActive: true },
                data: { isActive: false, deactivatedAt: deactivationTime },
            });
            return db_1.default.seller.findUniqueOrThrow({ where: { id: record.id }, select: SELLER_SELECT });
        });
    }
}
exports.SellerRepository = SellerRepository;
exports.sellerRepository = new SellerRepository();
