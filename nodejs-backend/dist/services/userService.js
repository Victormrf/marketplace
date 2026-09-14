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
exports.userService = exports.UserService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const userRepository_1 = require("../repositories/userRepository");
const email_1 = require("../utils/email");
const customErrors_1 = require("../utils/customErrors");
const REGISTRATION_FIELDS = new Set(["name", "email", "password", "role"]);
const UPDATE_FIELDS = new Set(["name", "email", "password"]);
function isUniqueViolation(error) {
    return error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
function requiredString(value, field) {
    if (typeof value !== "string" || value.trim() === "")
        throw new customErrors_1.ValidationError(`${field} is required`);
    return value.trim();
}
function validateEmail(value) {
    const email = requiredString(value, "email");
    if (!/^\S+@\S+\.\S+$/.test(email))
        throw new customErrors_1.ValidationError("Invalid email format");
    return (0, email_1.normalizeEmail)(email);
}
function rejectUnknown(input, fields) {
    const unknown = Object.keys(input).find((field) => !fields.has(field));
    if (unknown)
        throw new customErrors_1.ValidationError(`Unsupported user field: ${unknown}`);
}
class UserService {
    getById(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield userRepository_1.userRepository.findById(userId);
            if (!user)
                throw new customErrors_1.ObjectNotFoundError("User");
            return user;
        });
    }
    create(input) {
        return __awaiter(this, void 0, void 0, function* () {
            rejectUnknown(input, REGISTRATION_FIELDS);
            const name = requiredString(input.name, "name");
            const normalizedEmail = validateEmail(input.email);
            const password = requiredString(input.password, "password");
            if (password.length < 6)
                throw new customErrors_1.ValidationError("password must contain at least 6 characters");
            if (input.role !== client_1.UserRole.CUSTOMER && input.role !== client_1.UserRole.SELLER) {
                throw new customErrors_1.ValidationError("Only CUSTOMER or SELLER registration is allowed");
            }
            try {
                return yield userRepository_1.userRepository.create({
                    name,
                    email: normalizedEmail,
                    normalizedEmail,
                    password: yield bcrypt_1.default.hash(password, 10),
                    role: input.role,
                });
            }
            catch (error) {
                if (isUniqueViolation(error))
                    throw new customErrors_1.ConflictError("Email already in use");
                throw error;
            }
        });
    }
    update(userId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            rejectUnknown(input, UPDATE_FIELDS);
            if (Object.keys(input).length === 0)
                throw new customErrors_1.ValidationError("No fields to update");
            if (!(yield userRepository_1.userRepository.findById(userId)))
                throw new customErrors_1.ObjectNotFoundError("User");
            const data = {};
            if ("name" in input)
                data.name = requiredString(input.name, "name");
            if ("email" in input) {
                data.email = validateEmail(input.email);
                data.normalizedEmail = data.email;
            }
            if ("password" in input) {
                const password = requiredString(input.password, "password");
                if (password.length < 6)
                    throw new customErrors_1.ValidationError("password must contain at least 6 characters");
                data.password = yield bcrypt_1.default.hash(password, 10);
            }
            try {
                return yield userRepository_1.userRepository.update(userId, data);
            }
            catch (error) {
                if (isUniqueViolation(error))
                    throw new customErrors_1.ConflictError("Email already in use");
                throw error;
            }
        });
    }
    deactivate(userId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (actor.role !== client_1.UserRole.ADMIN)
                throw new customErrors_1.ForbiddenError();
            const record = yield userRepository_1.userRepository.findForDeactivation(userId);
            if (!record)
                throw new customErrors_1.ObjectNotFoundError("User");
            if (!record.isActive && !((_a = record.seller) === null || _a === void 0 ? void 0 : _a.isActive)) {
                return record;
            }
            return userRepository_1.userRepository.deactivateWithSeller(record, new Date());
        });
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
