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
exports.customerAddressRoutes = void 0;
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const customerAddressService_1 = require("../services/customerAddressService");
const customErrors_1 = require("../utils/customErrors");
const productRead_1 = require("../types/productRead");
exports.customerAddressRoutes = (0, express_1.Router)();
function pagination(query) {
    return {
        page: (0, productRead_1.parsePaginationValue)(query.page, productRead_1.DEFAULT_PAGE, "page"),
        limit: (0, productRead_1.parsePaginationValue)(query.limit, productRead_1.DEFAULT_LIMIT, "limit"),
    };
}
function sendError(error, res) {
    if (error instanceof customErrors_1.ValidationError)
        return res.status(400).json({ error: error.message });
    if (error instanceof customErrors_1.ForbiddenError)
        return res.status(403).json({ error: error.message });
    if (error instanceof customErrors_1.ObjectNotFoundError)
        return res.status(404).json({ error: error.message });
    if (error instanceof customErrors_1.ConflictError)
        return res.status(409).json({ error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
}
exports.customerAddressRoutes.use(authMiddleware_1.authMiddleware);
exports.customerAddressRoutes.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(201)
            .json(yield customerAddressService_1.customerAddressService.create(req.user.id, req.body || {}));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.customerAddressRoutes.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(200)
            .json(yield customerAddressService_1.customerAddressService.list(req.user.id, pagination(req.query)));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.customerAddressRoutes.get("/:addressId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(200)
            .json(yield customerAddressService_1.customerAddressService.get(req.user.id, req.params.addressId));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.customerAddressRoutes.put("/:addressId/default", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(200)
            .json(yield customerAddressService_1.customerAddressService.setDefault(req.user.id, req.params.addressId));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.customerAddressRoutes.put("/:addressId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res
            .status(200)
            .json(yield customerAddressService_1.customerAddressService.update(req.user.id, req.params.addressId, req.body || {}));
    }
    catch (error) {
        sendError(error, res);
    }
}));
exports.customerAddressRoutes.delete("/:addressId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield customerAddressService_1.customerAddressService.deactivate(req.user.id, req.params.addressId);
        res.status(204).send();
    }
    catch (error) {
        sendError(error, res);
    }
}));
