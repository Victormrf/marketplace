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
const authMiddleware_1 = require("../middlewares/authMiddleware");
const roleMiddleware_1 = require("../middlewares/roleMiddleware");
const customerService_1 = require("../services/customerService");
const customErrors_1 = require("../utils/customErrors");
exports.customerRoutes = (0, express_1.Router)();
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
exports.customerRoutes.post("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(201).json(yield customerService_1.customerService.createCustomerProfile(req.user.id, req.body || {}));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.customerRoutes.get("/all", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json({ profiles: yield customerService_1.customerService.getAllCustomers() });
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.customerRoutes.get("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json({ profile: yield customerService_1.customerService.getCustomerProfile(req.user.id) });
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.customerRoutes.put("/", authMiddleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).json(yield customerService_1.customerService.updateCustomerProfile(req.user.id, req.body || {}));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.customerRoutes.delete("/:userId", authMiddleware_1.authMiddleware, (0, roleMiddleware_1.roleMiddleware)("ADMIN"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield customerService_1.customerService.deleteCustomerProfile();
        res.status(204).send();
    }
    catch (error) {
        sendError(error, res);
    }
}));
