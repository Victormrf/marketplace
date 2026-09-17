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
exports.userRepository = exports.UserRepository = exports.USER_SAFE_SELECT = void 0;
const db_1 = __importDefault(require("../config/db"));
exports.USER_SAFE_SELECT = {
    id: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    createdAt: true,
};
const USER_AUTH_SELECT = Object.assign(Object.assign({}, exports.USER_SAFE_SELECT), { password: true });
const USER_DEACTIVATION_SELECT = Object.assign(Object.assign({}, exports.USER_SAFE_SELECT), { deactivatedAt: true, seller: { select: { id: true, isActive: true } } });
class UserRepository {
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.user.findUnique({ where: { id }, select: exports.USER_SAFE_SELECT });
        });
    }
    findForAuthentication(normalizedEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.user.findUnique({
                where: { normalizedEmail },
                select: USER_AUTH_SELECT,
            });
        });
    }
    findIdentity(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.findById(id);
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.user.create({ data, select: exports.USER_SAFE_SELECT });
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.user.update({
                where: { id },
                data,
                select: exports.USER_SAFE_SELECT,
            });
        });
    }
    findForDeactivation(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.user.findUnique({
                where: { id },
                select: USER_DEACTIVATION_SELECT,
            });
        });
    }
    deactivateWithSeller(record, deactivationTime) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                if (record.isActive) {
                    yield tx.user.updateMany({
                        where: { id: record.id, isActive: true },
                        data: { isActive: false, deactivatedAt: deactivationTime },
                    });
                }
                if ((_a = record.seller) === null || _a === void 0 ? void 0 : _a.isActive) {
                    yield tx.seller.updateMany({
                        where: { id: record.seller.id, isActive: true },
                        data: { isActive: false, deactivatedAt: deactivationTime },
                    });
                }
                return tx.user.findUniqueOrThrow({
                    where: { id: record.id },
                    select: exports.USER_SAFE_SELECT,
                });
            }));
        });
    }
}
exports.UserRepository = UserRepository;
exports.userRepository = new UserRepository();
