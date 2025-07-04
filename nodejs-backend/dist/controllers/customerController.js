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
exports.customerRoutes = void 0;
const express_1 = require("express");
const customerService_1 = require("../services/customerService");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const customErrors_1 = require("../utils/customErrors");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
exports.customerRoutes = (0, express_1.Router)();
const customerService = new customerService_1.CustomerService();
exports.customerRoutes.post("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const { address, phone } = req.body;
    try {
        const newProfile = yield customerService.createCustomerProfile(userId, {
            address,
            phone,
        });
        res
            .status(201)
            .json({ message: "Customer profile created with success", newProfile });
    }
    catch (error) {
        if (error instanceof customErrors_1.ExistingProfileError) {
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
exports.customerRoutes.get("/all", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const profiles = yield customerService.getAllCustomers();
        res.status(200).json({ profiles });
    }
    catch (error) {
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
}));
exports.customerRoutes.get("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    try {
        const profile = yield customerService.getCustomerProfile(userId);
        res.status(200).json({ profile });
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: error.message || "Internal Server Error" });
        return;
    }
}));
exports.customerRoutes.put("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const updateData = req.body;
    if (!updateData || Object.keys(updateData).length === 0) {
        res.status(400).json({ error: "No fields to update." });
        return;
    }
    try {
        const updatedCustomer = yield customerService.updateCustomerProfile(userId, req.body);
        res.json(updatedCustomer);
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}));
exports.customerRoutes.delete("/:userId", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    try {
        yield customerService.deleteCustomerProfile(userId);
        res.status(204).json({ message: "Customer was successfully deleted" });
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error });
    }
}));
