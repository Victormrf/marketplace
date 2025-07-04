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
exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const userModel_1 = require("../models/userModel");
const customErrors_1 = require("../utils/customErrors");
class AuthService {
    login(email, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const userModel = yield userModel_1.UserModel.getByEmail(email);
            if (!userModel || !userModel.password) {
                throw new customErrors_1.InvalidCredentialsError();
            }
            const isPasswordValid = yield bcrypt_1.default.compare(password, userModel.password);
            if (isPasswordValid) {
                // gerar o jwt
                return jsonwebtoken_1.default.sign({
                    id: userModel.id,
                    email: userModel.email,
                    role: userModel.role ? userModel.role : "user",
                }, process.env.JWT_SECRET || "your-secret-key", {
                    expiresIn: "1h",
                });
            }
            else {
                throw new customErrors_1.InvalidCredentialsError();
            }
        });
    }
}
exports.AuthService = AuthService;
