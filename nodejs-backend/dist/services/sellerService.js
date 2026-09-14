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
exports.sellerService = exports.SellerService = void 0;
const client_1 = require("@prisma/client");
const customerRepository_1 = require("../repositories/customerRepository");
const sellerRepository_1 = require("../repositories/sellerRepository");
const userRepository_1 = require("../repositories/userRepository");
const customErrors_1 = require("../utils/customErrors");
function sellerData(input, allowEmpty = false) {
    const allowed = new Set(["storeName", "description", "logo"]);
    const unknown = Object.keys(input).find((field) => !allowed.has(field));
    if (unknown)
        throw new customErrors_1.ValidationError(`Unsupported seller field: ${unknown}`);
    const data = {};
    if ("storeName" in input) {
        if (typeof input.storeName !== "string" || input.storeName.trim() === "")
            throw new customErrors_1.ValidationError("storeName is required");
        data.storeName = input.storeName.trim();
    }
    else if (!allowEmpty)
        throw new customErrors_1.ValidationError("storeName is required");
    if ("description" in input) {
        if (input.description !== null && typeof input.description !== "string")
            throw new customErrors_1.ValidationError("description must be a string");
        data.description = input.description === null ? null : input.description.trim() || null;
    }
    if ("logo" in input) {
        if (input.logo !== null && typeof input.logo !== "string")
            throw new customErrors_1.ValidationError("logo must be a string");
        data.logo = input.logo === null ? null : input.logo.trim() || null;
    }
    return data;
}
class SellerService {
    createSellerProfile(userId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield userRepository_1.userRepository.findById(userId);
            if (!user)
                throw new customErrors_1.ObjectNotFoundError("User");
            if (user.role !== client_1.UserRole.SELLER)
                throw new customErrors_1.ForbiddenError("Only SELLER users can create a seller profile");
            if ((yield sellerRepository_1.sellerRepository.findByUserId(userId)) || (yield customerRepository_1.customerRepository.findByUserId(userId)))
                throw new customErrors_1.ExistingProfileError();
            try {
                const data = sellerData(input);
                if (!data.storeName)
                    throw new customErrors_1.ValidationError("storeName is required");
                return yield sellerRepository_1.sellerRepository.create({ userId, storeName: data.storeName, logo: data.logo, description: data.description });
            }
            catch (error) {
                if ((error === null || error === void 0 ? void 0 : error.code) === "P2002")
                    throw new customErrors_1.ExistingProfileError();
                throw error;
            }
        });
    }
    getAllSellers() {
        return __awaiter(this, void 0, void 0, function* () {
            return sellerRepository_1.sellerRepository.findAll();
        });
    }
    getSellerProfile(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const seller = yield sellerRepository_1.sellerRepository.findByUserId(userId);
            if (!seller)
                throw new customErrors_1.ObjectNotFoundError("Seller");
            return seller;
        });
    }
    updateSellerProfile(userId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield sellerRepository_1.sellerRepository.findByUserId(userId)))
                throw new customErrors_1.ObjectNotFoundError("Seller");
            return sellerRepository_1.sellerRepository.update(userId, sellerData(input, true));
        });
    }
    deactivateSeller(userId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            if (actor.role !== client_1.UserRole.ADMIN && actor.id !== userId)
                throw new customErrors_1.ForbiddenError();
            const record = yield sellerRepository_1.sellerRepository.findForDeactivation(userId);
            if (!record)
                throw new customErrors_1.ObjectNotFoundError("Seller");
            if (!record.isActive) {
                return record;
            }
            return sellerRepository_1.sellerRepository.deactivate(record, new Date());
        });
    }
    deleteSellerProfile() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new customErrors_1.ValidationError("Seller profiles are not physically deleted");
        });
    }
}
exports.SellerService = SellerService;
exports.sellerService = new SellerService();
