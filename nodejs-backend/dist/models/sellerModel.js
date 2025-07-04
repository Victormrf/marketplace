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
exports.SellerModel = void 0;
const db_1 = __importDefault(require("../config/db"));
class SellerModel {
    constructor(data = {}) {
        this.fill(data);
    }
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.seller.create({
                data: {
                    userId: data.userId,
                    storeName: data.storeName,
                    description: data.description,
                    logo: data.logo,
                },
            });
        });
    }
    static getByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.seller.findUnique({
                where: { userId },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                        },
                    },
                },
            });
        });
    }
    static getAllSellers() {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.seller.findMany({
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
        });
    }
    static updateSeller(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.seller.update({
                where: { userId },
                data,
            });
        });
    }
    static deleteSeller(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.seller.delete({
                where: { userId },
            });
        });
    }
    fill(data) {
        if (data.id !== undefined)
            this.id = data.id;
        if (data.userId !== undefined)
            this.userId = data.userId;
        if (data.logo !== undefined)
            this.logo = data.logo;
        if (data.storeName !== undefined)
            this.storeName = data.storeName;
        if (data.description !== undefined)
            this.description = data.description;
    }
}
exports.SellerModel = SellerModel;
