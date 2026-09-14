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
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const userRepository_1 = require("../repositories/userRepository");
const jwt_1 = require("../utils/jwt");
function authMiddleware(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const authHeader = req.header("Authorization");
        const tokenFromHeader = (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith("Bearer ")) ? authHeader.slice(7) : undefined;
        const token = tokenFromHeader || ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token);
        if (!token) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, (0, jwt_1.requireJwtSecret)());
            if (typeof decoded.sub !== "string")
                throw new Error("Invalid subject");
            const user = yield userRepository_1.userRepository.findIdentity(decoded.sub);
            if (!user || !user.isActive || !Object.values(client_1.UserRole).includes(user.role))
                throw new Error("Inactive identity");
            req.user = { id: user.id, email: user.email, role: user.role };
            next();
        }
        catch (_b) {
            res.status(401).json({ message: "Invalid credentials" });
        }
    });
}
