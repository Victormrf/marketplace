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
const userRepository_1 = require("../repositories/userRepository");
const email_1 = require("../utils/email");
const customErrors_1 = require("../utils/customErrors");
const jwt_1 = require("../utils/jwt");
class AuthService {
    login(email, password) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof email !== "string" || typeof password !== "string")
                throw new customErrors_1.InvalidCredentialsError();
            const normalizedEmail = (0, email_1.normalizeEmail)(email);
            if (!normalizedEmail || !password)
                throw new customErrors_1.InvalidCredentialsError();
            const user = yield userRepository_1.userRepository.findForAuthentication(normalizedEmail);
            if (!user || !user.isActive || !(yield bcrypt_1.default.compare(password, user.password))) {
                throw new customErrors_1.InvalidCredentialsError();
            }
            return jsonwebtoken_1.default.sign({ sub: user.id }, (0, jwt_1.requireJwtSecret)(), { expiresIn: "1h" });
        });
    }
}
exports.AuthService = AuthService;
