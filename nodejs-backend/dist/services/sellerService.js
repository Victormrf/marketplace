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
exports.SellerService = void 0;
const customerModel_1 = require("../models/customerModel");
const sellerModel_1 = require("../models/sellerModel");
const customErrors_1 = require("../utils/customErrors");
class SellerService {
    createSellerProfile(userId, sellerData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!sellerData.storeName || !sellerData.description) {
                throw new customErrors_1.ValidationError("Missing required fields");
            }
            const existingCustomer = yield customerModel_1.CustomerModel.getByUserId(userId);
            const existingSeller = yield sellerModel_1.SellerModel.getByUserId(userId);
            if (existingCustomer || existingSeller) {
                throw new customErrors_1.ExistingProfileError();
            }
            return yield sellerModel_1.SellerModel.create(Object.assign({ userId }, sellerData));
        });
    }
    getAllSellers() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield sellerModel_1.SellerModel.getAllSellers();
        });
    }
    getSellerProfile(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const seller = yield sellerModel_1.SellerModel.getByUserId(userId);
            if (!seller) {
                throw new customErrors_1.ObjectNotFoundError("Seller");
            }
            return seller;
        });
    }
    updateSellerProfile(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const seller = yield sellerModel_1.SellerModel.getByUserId(userId);
            if (!seller) {
                throw new customErrors_1.ObjectNotFoundError("Seller");
            }
            try {
                return yield sellerModel_1.SellerModel.updateSeller(userId, data);
            }
            catch (error) {
                throw new Error(`Failed to update seller: ${error.message}`);
            }
        });
    }
    deleteSellerProfile(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const seller = yield sellerModel_1.SellerModel.getByUserId(userId);
            if (!seller) {
                throw new customErrors_1.ObjectNotFoundError("Seller");
            }
            try {
                return yield sellerModel_1.SellerModel.deleteSeller(userId);
            }
            catch (error) {
                throw new Error(`Failed to delete seller: ${error.message}`);
            }
        });
    }
}
exports.SellerService = SellerService;
