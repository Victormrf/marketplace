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
exports.CustomerModel = void 0;
const db_1 = __importDefault(require("../config/db"));
class CustomerModel {
    constructor(data = {}) {
        this.fill(data);
    }
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.customer.create({
                data: {
                    userId: data.userId,
                    address: data.address,
                    phone: data.phone,
                },
            });
        });
    }
    static getByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.customer.findUnique({
                where: { userId },
            });
        });
    }
    static getAllCustomers() {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.customer.findMany({
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
    static updateCustomer(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.customer.update({
                where: { userId },
                data,
            });
        });
    }
    static deleteCustomer(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.customer.delete({
                where: { userId },
            });
        });
    }
    fill(data) {
        if (data.id !== undefined)
            this.id = data.id;
        if (data.userId !== undefined)
            this.userId = data.userId;
        if (data.address !== undefined)
            this.address = data.address;
        if (data.phone !== undefined)
            this.phone = data.phone;
    }
}
exports.CustomerModel = CustomerModel;
