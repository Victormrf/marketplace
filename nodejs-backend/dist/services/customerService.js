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
exports.customerService = exports.CustomerService = void 0;
const client_1 = require("@prisma/client");
const customerRepository_1 = require("../repositories/customerRepository");
const sellerRepository_1 = require("../repositories/sellerRepository");
const userRepository_1 = require("../repositories/userRepository");
const customErrors_1 = require("../utils/customErrors");
function profileData(input) {
    const unknown = Object.keys(input).find((field) => field !== "phone");
    if (unknown)
        throw new customErrors_1.ValidationError(`Unsupported customer field: ${unknown}`);
    if (input.phone !== undefined &&
        input.phone !== null &&
        typeof input.phone !== "string") {
        throw new customErrors_1.ValidationError("phone must be a string");
    }
    return {
        phone: input.phone === undefined || input.phone === null
            ? null
            : input.phone.trim() || null,
    };
}
class CustomerService {
    toDto(record) {
        return { id: record.id, userId: record.userId, phone: record.phone };
    }
    toWithUserDto(record) {
        return {
            id: record.id,
            userId: record.userId,
            phone: record.phone,
            user: record.user,
        };
    }
    createCustomerProfile(userId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield userRepository_1.userRepository.findById(userId);
            if (!user)
                throw new customErrors_1.ObjectNotFoundError("User");
            if (user.role !== client_1.UserRole.CUSTOMER)
                throw new customErrors_1.ForbiddenError("Only CUSTOMER users can create a customer profile");
            if ((yield customerRepository_1.customerRepository.findByUserId(userId)) ||
                (yield sellerRepository_1.sellerRepository.findByUserId(userId)))
                throw new customErrors_1.ExistingProfileError();
            try {
                return this.toDto(yield customerRepository_1.customerRepository.create(Object.assign({ userId }, profileData(input))));
            }
            catch (error) {
                if ((error === null || error === void 0 ? void 0 : error.code) === "P2002")
                    throw new customErrors_1.ExistingProfileError();
                throw error;
            }
        });
    }
    getAllCustomers() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield customerRepository_1.customerRepository.findAll()).map((record) => this.toWithUserDto(record));
        });
    }
    getCustomerProfile(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const customer = yield customerRepository_1.customerRepository.findByUserId(userId);
            if (!customer)
                throw new customErrors_1.ObjectNotFoundError("Customer");
            return this.toDto(customer);
        });
    }
    updateCustomerProfile(userId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield customerRepository_1.customerRepository.findByUserId(userId)))
                throw new customErrors_1.ObjectNotFoundError("Customer");
            return this.toDto(yield customerRepository_1.customerRepository.update(userId, profileData(input)));
        });
    }
    deleteCustomerProfile() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new customErrors_1.ValidationError("Customer profiles are not physically deleted");
        });
    }
}
exports.CustomerService = CustomerService;
exports.customerService = new CustomerService();
