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
exports.inventoryRepository = exports.InventoryRepository = void 0;
const client_1 = require("@prisma/client");
const db_1 = __importDefault(require("../config/db"));
const INVENTORY_AUTH_SELECT = {
    id: true,
    productId: true,
    onHandQuantity: true,
    reservedQuantity: true,
    product: {
        select: {
            isActive: true,
            sellerId: true,
            seller: { select: { userId: true, isActive: true } },
        },
    },
};
const MOVEMENT_SELECT = {
    id: true,
    inventoryId: true,
    orderItemId: true,
    movementType: true,
    onHandDelta: true,
    reservedDelta: true,
    onHandAfter: true,
    reservedAfter: true,
    reason: true,
    createdAt: true,
};
function mapAuthorization(row) {
    return {
        inventoryId: row.id,
        productId: row.productId,
        productIsActive: row.product.isActive,
        sellerId: row.product.sellerId,
        sellerUserId: row.product.seller.userId,
        sellerIsActive: row.product.seller.isActive,
        onHandQuantity: row.onHandQuantity,
        reservedQuantity: row.reservedQuantity,
    };
}
class InventoryRepository {
    findByProductForAuthorization(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield db_1.default.inventory.findUnique({
                where: { productId },
                select: INVENTORY_AUTH_SELECT,
            });
            return row ? mapAuthorization(row) : null;
        });
    }
    findSnapshotByProduct(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield db_1.default.inventory.findUnique({
                where: { productId },
                select: { productId: true, onHandQuantity: true, reservedQuantity: true },
            });
            return row;
        });
    }
    applyOnHandMovement(inventoryId, movementType, onHandDelta, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const updated = yield tx.$queryRaw(client_1.Prisma.sql `
        UPDATE "inventory"
        SET "onHandQuantity" = "onHandQuantity" + ${onHandDelta},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${inventoryId}
          AND "onHandQuantity" + ${onHandDelta} >= 0
          AND "onHandQuantity" + ${onHandDelta} >= "reservedQuantity"
        RETURNING "onHandQuantity", "reservedQuantity"
      `);
                if (updated.length === 0)
                    return null;
                const after = updated[0];
                return tx.inventoryMovement.create({
                    data: {
                        inventoryId,
                        orderItemId: null,
                        movementType,
                        onHandDelta,
                        reservedDelta: 0,
                        onHandAfter: after.onHandQuantity,
                        reservedAfter: after.reservedQuantity,
                        reason,
                    },
                    select: MOVEMENT_SELECT,
                });
            }));
        });
    }
    findMovements(inventoryId, skip, take) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = { inventoryId };
            const [total, data] = yield db_1.default.$transaction([
                db_1.default.inventoryMovement.count({ where }),
                db_1.default.inventoryMovement.findMany({
                    where,
                    select: MOVEMENT_SELECT,
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    skip,
                    take,
                }),
            ]);
            return { total, data };
        });
    }
}
exports.InventoryRepository = InventoryRepository;
exports.inventoryRepository = new InventoryRepository();
