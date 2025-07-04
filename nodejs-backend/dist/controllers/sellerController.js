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
exports.sellerRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const customErrors_1 = require("../utils/customErrors");
const sellerService_1 = require("../services/sellerService");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
const uploadSellerLogo_1 = __importDefault(require("../middlewares/uploadSellerLogo"));
exports.sellerRoutes = (0, express_1.Router)();
const sellerService = new sellerService_1.SellerService();
exports.sellerRoutes.post("/", authMiddleware_1.authMiddleware, uploadSellerLogo_1.default.single("logo"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = req.user.id;
    const { storeName, description } = req.body;
    const logoUrl = ((_a = req.file) === null || _a === void 0 ? void 0 : _a.path) || null;
    try {
        const newProfile = yield sellerService.createSellerProfile(userId, {
            storeName,
            description,
            logo: logoUrl,
        });
        res
            .status(201)
            .json({ message: "Seller profile created with success", newProfile });
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
exports.sellerRoutes.get("/all", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const profiles = yield sellerService.getAllSellers();
        res.status(200).json({ profiles });
    }
    catch (error) {
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
}));
exports.sellerRoutes.get("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    try {
        const profile = yield sellerService.getSellerProfile(userId);
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
exports.sellerRoutes.put("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const updateData = req.body;
    if (!updateData || Object.keys(updateData).length === 0) {
        res.status(400).json({ error: "No fields to update" });
        return;
    }
    try {
        const updatedSeller = yield sellerService.updateSellerProfile(userId, req.body);
        res.json(updatedSeller);
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
exports.sellerRoutes.delete("/:userId", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    try {
        yield sellerService.deleteSellerProfile(userId);
        res.status(204).json({ message: "Seller was successfully deleted" });
    }
    catch (error) {
        if (error instanceof customErrors_1.ObjectNotFoundError) {
            res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error });
    }
}));
