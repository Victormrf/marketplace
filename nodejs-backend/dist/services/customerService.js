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
exports.CustomerService = void 0;
const customerModel_1 = require("../models/customerModel");
const sellerModel_1 = require("../models/sellerModel");
const customErrors_1 = require("../utils/customErrors");
class CustomerService {
    createCustomerProfile(userId, customerData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!customerData.address || !customerData.phone) {
                throw new customErrors_1.ValidationError("Missing required fields");
            }
            const existingCustomer = yield customerModel_1.CustomerModel.getByUserId(userId);
            const existingSeller = yield sellerModel_1.SellerModel.getByUserId(userId);
            if (existingCustomer || existingSeller) {
                throw new customErrors_1.ExistingProfileError();
            }
            return yield customerModel_1.CustomerModel.create(Object.assign({ userId }, customerData));
        });
    }
    getAllCustomers() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield customerModel_1.CustomerModel.getAllCustomers();
        });
    }
    getCustomerProfile(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const customer = yield customerModel_1.CustomerModel.getByUserId(userId);
            if (!customer) {
                throw new customErrors_1.ObjectNotFoundError("Customer");
            }
            return customer;
        });
    }
    updateCustomerProfile(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const customer = yield customerModel_1.CustomerModel.getByUserId(userId);
            if (!customer) {
                throw new customErrors_1.ObjectNotFoundError("Customer");
            }
            try {
                return yield customerModel_1.CustomerModel.updateCustomer(userId, data);
            }
            catch (error) {
                throw new Error(`Failed to update customer: ${error.message}`);
            }
        });
    }
    deleteCustomerProfile(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const customer = yield customerModel_1.CustomerModel.getByUserId(userId);
            if (!customer) {
                throw new customErrors_1.ObjectNotFoundError("Customer");
            }
            try {
                return yield customerModel_1.CustomerModel.deleteCustomer(userId);
            }
            catch (error) {
                throw new Error(`Failed to delete customer: ${error.message}`);
            }
        });
    }
}
exports.CustomerService = CustomerService;
