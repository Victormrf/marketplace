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
exports.UserModel = exports.UserRole = void 0;
const db_1 = __importDefault(require("../config/db"));
const bcrypt_1 = __importDefault(require("bcrypt"));
var UserRole;
(function (UserRole) {
    UserRole["CUSTOMER"] = "CUSTOMER";
    UserRole["SELLER"] = "SELLER";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
class UserModel {
    constructor(data = {}) {
        this.fill(data);
    }
    static create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const saltRounds = 10;
            const hashedPassword = yield bcrypt_1.default.hash(data.password, saltRounds);
            return db_1.default.user.create({
                data: {
                    name: data.name,
                    email: data.email,
                    password: hashedPassword,
                    role: data.role,
                },
            });
        });
    }
    static getById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.user.findUnique({
                where: { id },
            });
        });
    }
    static getByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.user.findUnique({
                where: { email },
            });
        });
    }
    static update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.user.update({
                where: { id },
                data,
            });
        });
    }
    static delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.user.delete({
                where: { id },
            });
        });
    }
    fill(data) {
        if (data.id !== undefined)
            this.id = data.id;
        if (data.name !== undefined)
            this.name = data.name;
        if (data.email !== undefined)
            this.email = data.email;
        if (data.password !== undefined)
            this.password = data.password;
        if (data.createdAt !== undefined)
            this.createdAt = data.createdAt;
    }
}
exports.UserModel = UserModel;
