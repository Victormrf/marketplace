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
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
const uploadSellerLogo_1 = __importDefault(require("../middlewares/uploadSellerLogo"));
const sellerService_1 = require("../services/sellerService");
const customErrors_1 = require("../utils/customErrors");
exports.sellerRoutes = (0, express_1.Router)();
function sendError(error, res) {
    if (error instanceof customErrors_1.ValidationError)
        return res.status(400).json({ error: error.message });
    if (error instanceof customErrors_1.ForbiddenError)
        return res.status(403).json({ error: error.message });
    if (error instanceof customErrors_1.ObjectNotFoundError)
        return res.status(404).json({ error: error.message });
    if (error instanceof customErrors_1.ExistingProfileError || error instanceof customErrors_1.ConflictError)
        return res.status(409).json({ error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
}
exports.sellerRoutes.post("/", authMiddleware_1.authMiddleware, uploadSellerLogo_1.default.single("logo"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(201).json(yield sellerService_1.sellerService.createSellerProfile(req.user.id, Object.assign(Object.assign({}, (req.body || {})), (req.file ? { logo: req.file.path } : {}))));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.sellerRoutes.get("/all", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json({ profiles: yield sellerService_1.sellerService.getAllSellers() });
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.sellerRoutes.get("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json({ profile: yield sellerService_1.sellerService.getSellerProfile(req.user.id) });
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.sellerRoutes.put("/", authMiddleware_1.authMiddleware, uploadSellerLogo_1.default.single("logo"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield sellerService_1.sellerService.updateSellerProfile(req.user.id, Object.assign(Object.assign({}, (req.body || {})), (req.file ? { logo: req.file.path } : {}))));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.sellerRoutes.delete("/:userId", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield sellerService_1.sellerService.deactivateSeller(req.params.userId, req.user);
        res.status(204).send();
    }
    catch (error) {
        sendError(error, res);
    }
}));
