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
exports.UserService = void 0;
const library_1 = require("@prisma/client/runtime/library");
const userModel_1 = require("../models/userModel");
const customErrors_1 = require("../utils/customErrors");
class UserService {
    getById(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield userModel_1.UserModel.getById(userId);
            if (!user) {
                throw new customErrors_1.ObjectNotFoundError("User");
            }
            return user;
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data.email || !data.password || !data.name || !data.role) {
                throw new customErrors_1.ValidationError("Missing required fields");
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                throw new customErrors_1.ValidationError("Invalid email format");
            }
            try {
                return yield userModel_1.UserModel.create(data);
            }
            catch (error) {
                if (error instanceof library_1.PrismaClientKnownRequestError &&
                    error.code === "P2002") {
                    throw new customErrors_1.ConflictError("Email already on use");
                }
                throw error; // Re-lança o erro
            }
        });
    }
    update(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield userModel_1.UserModel.getById(userId);
            if (!user) {
                throw new customErrors_1.ObjectNotFoundError("User");
            }
            // Validação do e-mail, se fornecido
            if (data.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(data.email)) {
                    throw new customErrors_1.ValidationError("Invalid email format");
                }
            }
            try {
                return yield userModel_1.UserModel.update(userId, data);
            }
            catch (error) {
                throw new Error(`Failed to update user: ${error.message}`);
            }
        });
    }
    delete(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield userModel_1.UserModel.getById(userId);
            if (!user) {
                throw new customErrors_1.ObjectNotFoundError("User");
            }
            return yield userModel_1.UserModel.delete(userId);
        });
    }
}
exports.UserService = UserService;
