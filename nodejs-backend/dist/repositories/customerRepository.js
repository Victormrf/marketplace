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
exports.customerRepository = exports.CustomerRepository = void 0;
const db_1 = __importDefault(require("../config/db"));
const userRepository_1 = require("./userRepository");
const CUSTOMER_SELECT = {
    id: true,
    userId: true,
    phone: true,
};
const CUSTOMER_WITH_USER_SELECT = Object.assign(Object.assign({}, CUSTOMER_SELECT), { user: { select: userRepository_1.USER_SAFE_SELECT } });
class CustomerRepository {
    findByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.customerProfile.findUnique({ where: { userId }, select: CUSTOMER_SELECT });
        });
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.customerProfile.findMany({
                select: CUSTOMER_WITH_USER_SELECT,
                orderBy: { createdAt: "desc" },
            });
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.customerProfile.create({ data, select: CUSTOMER_SELECT });
        });
    }
    update(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.customerProfile.update({ where: { userId }, data, select: CUSTOMER_SELECT });
        });
    }
}
exports.CustomerRepository = CustomerRepository;
exports.customerRepository = new CustomerRepository();
