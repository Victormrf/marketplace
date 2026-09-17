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
exports.customerAddressRepository = exports.CustomerAddressRepository = void 0;
const client_1 = require("@prisma/client");
const db_1 = __importDefault(require("../config/db"));
const ADDRESS_SELECT = {
    id: true,
    recipientName: true,
    postalCode: true,
    street: true,
    number: true,
    complement: true,
    neighborhood: true,
    city: true,
    state: true,
    countryCode: true,
    phone: true,
    isDefault: true,
    createdAt: true,
    updatedAt: true,
};
const ADDRESS_DEACTIVATION_SELECT = Object.assign(Object.assign({}, ADDRESS_SELECT), { isActive: true });
function lockCustomer(tx, customerId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield tx.$queryRaw(client_1.Prisma.sql `
    SELECT "id"
    FROM "customer"
    WHERE "id" = ${customerId}
    FOR UPDATE
  `);
    });
}
class CustomerAddressRepository {
    count(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.customerAddress.count({
                where: { customerId, isActive: true },
            });
        });
    }
    findMany(customerId, skip, take) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.customerAddress.findMany({
                where: { customerId, isActive: true },
                select: ADDRESS_SELECT,
                orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }, { id: "asc" }],
                skip,
                take,
            });
        });
    }
    findActiveById(customerId, addressId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.customerAddress.findFirst({
                where: { id: addressId, customerId, isActive: true },
                select: ADDRESS_SELECT,
            });
        });
    }
    create(customerId, data, requestedDefault) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                yield lockCustomer(tx, customerId);
                const activeCount = yield tx.customerAddress.count({
                    where: { customerId, isActive: true },
                });
                const shouldBeDefault = requestedDefault || activeCount === 0;
                if (shouldBeDefault) {
                    yield tx.customerAddress.updateMany({
                        where: { customerId, isActive: true, isDefault: true },
                        data: { isDefault: false },
                    });
                }
                return tx.customerAddress.create({
                    data: Object.assign(Object.assign({}, data), { customerId, isDefault: shouldBeDefault }),
                    select: ADDRESS_SELECT,
                });
            }));
        });
    }
    update(customerId, addressId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const result = yield tx.customerAddress.updateMany({
                    where: { id: addressId, customerId, isActive: true },
                    data,
                });
                if (result.count === 0)
                    return null;
                return tx.customerAddress.findUniqueOrThrow({
                    where: { id: addressId },
                    select: ADDRESS_SELECT,
                });
            }));
        });
    }
    setDefault(customerId, addressId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                yield lockCustomer(tx, customerId);
                const address = yield tx.customerAddress.findFirst({
                    where: { id: addressId, customerId, isActive: true },
                    select: ADDRESS_SELECT,
                });
                if (!address)
                    return null;
                if (address.isDefault)
                    return address;
                yield tx.customerAddress.updateMany({
                    where: { customerId, isActive: true, isDefault: true },
                    data: { isDefault: false },
                });
                return tx.customerAddress.update({
                    where: { id: addressId },
                    data: { isDefault: true },
                    select: ADDRESS_SELECT,
                });
            }));
        });
    }
    deactivate(customerId, addressId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                yield lockCustomer(tx, customerId);
                const address = yield tx.customerAddress.findFirst({
                    where: { id: addressId, customerId },
                    select: ADDRESS_DEACTIVATION_SELECT,
                });
                if (!address || !address.isActive)
                    return address;
                return tx.customerAddress.update({
                    where: { id: addressId },
                    data: { isActive: false, isDefault: false },
                    select: ADDRESS_SELECT,
                });
            }));
        });
    }
}
exports.CustomerAddressRepository = CustomerAddressRepository;
exports.customerAddressRepository = new CustomerAddressRepository();
