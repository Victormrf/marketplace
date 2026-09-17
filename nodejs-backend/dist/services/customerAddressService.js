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
exports.customerAddressService = exports.CustomerAddressService = void 0;
const client_1 = require("@prisma/client");
const customerAddressRepository_1 = require("../repositories/customerAddressRepository");
const customerRepository_1 = require("../repositories/customerRepository");
const userRepository_1 = require("../repositories/userRepository");
const customErrors_1 = require("../utils/customErrors");
function toDto(address) {
    return Object.assign(Object.assign({}, address), { countryCode: "BR" });
}
const ADDRESS_FIELDS = new Set([
    "recipientName",
    "postalCode",
    "street",
    "number",
    "complement",
    "neighborhood",
    "city",
    "state",
    "countryCode",
    "phone",
    "isDefault",
]);
const UPDATE_FIELDS = new Set([
    "recipientName",
    "postalCode",
    "street",
    "number",
    "complement",
    "neighborhood",
    "city",
    "state",
    "countryCode",
    "phone",
]);
function rejectUnknown(input, allowed) {
    const unknown = Object.keys(input).find((field) => !allowed.has(field));
    if (unknown)
        throw new customErrors_1.ValidationError(`Unsupported address field: ${unknown}`);
}
function requiredString(value, field) {
    if (typeof value !== "string" || value.trim() === "")
        throw new customErrors_1.ValidationError(`${field} is required`);
    return value.trim();
}
function normalizeAddress(input, includeDefault) {
    rejectUnknown(input, includeDefault ? ADDRESS_FIELDS : UPDATE_FIELDS);
    if (!includeDefault) {
        if (Object.keys(input).length === 0)
            throw new customErrors_1.ValidationError("No fields to update");
        const data = {};
        if ("recipientName" in input)
            data.recipientName = requiredString(input.recipientName, "recipientName");
        if ("postalCode" in input)
            data.postalCode = normalizePostalCode(input.postalCode);
        if ("street" in input)
            data.street = requiredString(input.street, "street");
        if ("number" in input)
            data.number = requiredString(input.number, "number");
        if ("complement" in input)
            data.complement = optionalString(input.complement, "complement");
        if ("neighborhood" in input)
            data.neighborhood = requiredString(input.neighborhood, "neighborhood");
        if ("city" in input)
            data.city = requiredString(input.city, "city");
        if ("state" in input)
            data.state = requiredString(input.state, "state").toUpperCase();
        if ("countryCode" in input)
            data.countryCode = normalizeCountry(input.countryCode);
        if ("phone" in input)
            data.phone = optionalString(input.phone, "phone");
        return { data };
    }
    const data = {
        recipientName: requiredString(input.recipientName, "recipientName"),
        postalCode: normalizePostalCode(input.postalCode),
        street: requiredString(input.street, "street"),
        number: requiredString(input.number, "number"),
        complement: optionalString(input.complement, "complement"),
        neighborhood: requiredString(input.neighborhood, "neighborhood"),
        city: requiredString(input.city, "city"),
        state: requiredString(input.state, "state").toUpperCase(),
        countryCode: normalizeCountry(input.countryCode),
        phone: optionalString(input.phone, "phone"),
    };
    if (includeDefault) {
        if (input.isDefault !== undefined && typeof input.isDefault !== "boolean") {
            throw new customErrors_1.ValidationError("isDefault must be boolean");
        }
        return { data, requestedDefault: input.isDefault === true };
    }
    return { data };
}
function optionalString(value, field) {
    if (value === undefined || value === null)
        return null;
    if (typeof value !== "string")
        throw new customErrors_1.ValidationError(`${field} must be a string`);
    return value.trim() || null;
}
function normalizePostalCode(value) {
    const postalCode = requiredString(value, "postalCode");
    if (!/^\d{5}-?\d{3}$/.test(postalCode))
        throw new customErrors_1.ValidationError("Invalid postalCode");
    return postalCode.replace("-", "");
}
function normalizeCountry(value) {
    if (value === undefined)
        return "BR";
    if (typeof value !== "string" || value.trim().toUpperCase() !== "BR")
        throw new customErrors_1.ValidationError("Only BR countryCode is supported");
    return "BR";
}
class CustomerAddressService {
    constructor(repository = customerAddressRepository_1.customerAddressRepository) {
        this.repository = repository;
    }
    customerIdFor(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield userRepository_1.userRepository.findById(userId);
            if (!user || !user.isActive)
                throw new customErrors_1.ObjectNotFoundError("Customer");
            if (user.role !== client_1.UserRole.CUSTOMER)
                throw new customErrors_1.ForbiddenError("Only CUSTOMER users can manage addresses");
            const customer = yield customerRepository_1.customerRepository.findByUserId(userId);
            if (!customer)
                throw new customErrors_1.ObjectNotFoundError("Customer");
            return customer.id;
        });
    }
    list(userId, pagination) {
        return __awaiter(this, void 0, void 0, function* () {
            const customerId = yield this.customerIdFor(userId);
            const [total, data] = yield Promise.all([
                this.repository.count(customerId),
                this.repository.findMany(customerId, (pagination.page - 1) * pagination.limit, pagination.limit),
            ]);
            return {
                data: data.map(toDto),
                pagination: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total,
                    totalPages: Math.ceil(total / pagination.limit),
                },
            };
        });
    }
    get(userId, addressId) {
        return __awaiter(this, void 0, void 0, function* () {
            const customerId = yield this.customerIdFor(userId);
            const address = yield this.repository.findActiveById(customerId, addressId);
            if (!address)
                throw new customErrors_1.ObjectNotFoundError("Customer address");
            return toDto(address);
        });
    }
    create(userId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const customerId = yield this.customerIdFor(userId);
            const normalized = normalizeAddress(input, true);
            return toDto(yield this.repository.create(customerId, normalized.data, (_a = normalized.requestedDefault) !== null && _a !== void 0 ? _a : false));
        });
    }
    update(userId, addressId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const customerId = yield this.customerIdFor(userId);
            if (Object.keys(input).length === 0)
                throw new customErrors_1.ValidationError("No fields to update");
            const normalized = normalizeAddress(input, false);
            const address = yield this.repository.update(customerId, addressId, normalized.data);
            if (!address)
                throw new customErrors_1.ObjectNotFoundError("Customer address");
            return toDto(address);
        });
    }
    setDefault(userId, addressId) {
        return __awaiter(this, void 0, void 0, function* () {
            const customerId = yield this.customerIdFor(userId);
            const address = yield this.repository.setDefault(customerId, addressId);
            if (!address)
                throw new customErrors_1.ObjectNotFoundError("Customer address");
            return toDto(address);
        });
    }
    deactivate(userId, addressId) {
        return __awaiter(this, void 0, void 0, function* () {
            const customerId = yield this.customerIdFor(userId);
            const address = yield this.repository.deactivate(customerId, addressId);
            if (!address)
                throw new customErrors_1.ObjectNotFoundError("Customer address");
        });
    }
}
exports.CustomerAddressService = CustomerAddressService;
exports.customerAddressService = new CustomerAddressService();
