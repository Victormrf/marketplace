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
exports.userRoutes = void 0;
const express_1 = require("express");
const userService_1 = require("../services/userService");
const customErrors_1 = require("../utils/customErrors");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
exports.userRoutes = (0, express_1.Router)();
const userService = new userService_1.UserService();
exports.userRoutes.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, email, password, role } = req.body;
    try {
        const newUser = yield userService.create({ name, email, password, role });
        res.status(201).json(newUser);
    }
    catch (error) {
        if (error instanceof customErrors_1.ConflictError) {
            res.status(409).json({ error: error.message });
        }
        else if (error instanceof customErrors_1.ValidationError) {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error });
        }
    }
}));
exports.userRoutes.get("/me", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    try {
        const user = yield userService.getById(userId);
        res.json(user);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ message: error.message });
        }
        else {
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
}));
exports.userRoutes.put("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const updateData = req.body;
    if (!updateData || Object.keys(updateData).length === 0) {
        res.status(400).json({ error: "No fields to update" });
    }
    try {
        const updatedUser = yield userService.update(userId, req.body);
        res.json(updatedUser);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        if (error instanceof customErrors_1.ValidationError) {
            res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
exports.userRoutes.delete("/:userId", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    try {
        yield userService.delete(userId);
        res.status(204).json({ message: "User was successfully deleted" });
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error });
    }
}));
