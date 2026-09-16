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
exports.inventoryService = exports.InventoryService = exports.InventoryForbiddenError = void 0;
const client_1 = require("@prisma/client");
const inventoryRepository_1 = require("../repositories/inventoryRepository");
const customErrors_1 = require("../utils/customErrors");
class InventoryForbiddenError extends Error {
    constructor() {
        super("You do not have permission to manage this inventory");
        this.name = "InventoryForbiddenError";
    }
}
exports.InventoryForbiddenError = InventoryForbiddenError;
function toDto(snapshot) {
    return {
        productId: snapshot.productId,
        onHandQuantity: snapshot.onHandQuantity,
        reservedQuantity: snapshot.reservedQuantity,
        availableQuantity: snapshot.onHandQuantity - snapshot.reservedQuantity,
    };
}
function toMovementDto(movement) {
    return Object.assign({}, movement);
}
function positiveInteger(value, field) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new customErrors_1.ValidationError(`${field} must be a positive integer`);
    }
    return value;
}
function nonZeroInteger(value, field) {
    if (!Number.isSafeInteger(value) || value === 0) {
        throw new customErrors_1.ValidationError(`${field} must be a non-zero integer`);
    }
    return value;
}
function requiredReason(value) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new customErrors_1.ValidationError("reason is required");
    }
    return value.trim();
}
class InventoryService {
    constructor(repository = inventoryRepository_1.inventoryRepository) {
        this.repository = repository;
    }
    authorize(productId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            const record = yield this.repository.findByProductForAuthorization(productId);
            if (!record || !record.productIsActive || !record.sellerIsActive) {
                throw new customErrors_1.ObjectNotFoundError("Product or inventory");
            }
            if (actor.role === "ADMIN")
                return record;
            if (actor.role !== "SELLER" || record.sellerUserId !== actor.id) {
                throw new InventoryForbiddenError();
            }
            return record;
        });
    }
    getInventory(productId, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            const record = yield this.authorize(productId, actor);
            return toDto(record);
        });
    }
    restock(productId, actor, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const quantity = positiveInteger(input.quantity, "quantity");
            const reason = input.reason === undefined ? null : requiredReason(input.reason);
            const record = yield this.authorize(productId, actor);
            const movement = yield this.repository.applyOnHandMovement(record.inventoryId, client_1.InventoryMovementType.RESTOCK, quantity, reason);
            if (!movement)
                throw new customErrors_1.ConflictError("Inventory movement cannot be applied");
            return toDto({ productId, onHandQuantity: movement.onHandAfter, reservedQuantity: movement.reservedAfter });
        });
    }
    adjust(productId, actor, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const onHandDelta = nonZeroInteger(input.onHandDelta, "onHandDelta");
            const reason = requiredReason(input.reason);
            const record = yield this.authorize(productId, actor);
            const movement = yield this.repository.applyOnHandMovement(record.inventoryId, client_1.InventoryMovementType.MANUAL_CORRECTION, onHandDelta, reason);
            if (!movement)
                throw new customErrors_1.ConflictError("Inventory movement cannot be applied");
            return toDto({ productId, onHandQuantity: movement.onHandAfter, reservedQuantity: movement.reservedAfter });
        });
    }
    listMovements(productId, actor, pagination) {
        return __awaiter(this, void 0, void 0, function* () {
            const record = yield this.authorize(productId, actor);
            const result = yield this.repository.findMovements(record.inventoryId, (pagination.page - 1) * pagination.limit, pagination.limit);
            return {
                data: result.data.map(toMovementDto),
                pagination: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / pagination.limit),
                },
            };
        });
    }
}
exports.InventoryService = InventoryService;
exports.inventoryService = new InventoryService();
