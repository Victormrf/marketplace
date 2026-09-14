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
exports.authRoutes = void 0;
const express_1 = require("express");
const authService_1 = require("../services/authService");
const customErrors_1 = require("../utils/customErrors");
const jwt_1 = require("../utils/jwt");
exports.authRoutes = (0, express_1.Router)();
const authService = new authService_1.AuthService();
exports.authRoutes.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const token = yield authService.login((_a = req.body) === null || _a === void 0 ? void 0 : _a.email, (_b = req.body) === null || _b === void 0 ? void 0 : _b.password);
        res.cookie("token", token, (0, jwt_1.cookieOptions)());
        res.status(200).json({ message: "User logged in successfully." });
    }
    catch (error) {
        if (error instanceof customErrors_1.InvalidCredentialsError) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        res.status(500).json({ message: "Internal Server Error" });
    }
}));
exports.authRoutes.post("/logout", (req, res) => {
    const options = (0, jwt_1.cookieOptions)();
    res.clearCookie("token", { httpOnly: options.httpOnly, secure: options.secure, sameSite: options.sameSite });
    res.status(200).json({ message: "User logged out successfully." });
});
