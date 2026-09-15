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
exports.cartRepository = exports.CartRepository = exports.CartMutationConflictError = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const db_1 = __importDefault(require("../config/db"));
const CART_SELECT = {
    id: true,
    status: true,
    items: {
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: {
            id: true,
            productId: true,
            quantity: true,
            product: {
                select: {
                    isActive: true,
                    name: true,
                    priceInCents: true,
                    currency: true,
                    image: true,
                    seller: { select: { isActive: true } },
                    inventory: { select: { onHandQuantity: true, reservedQuantity: true } },
                },
            },
        },
    },
};
const CART_ITEM_SELECT = {
    id: true,
    productId: true,
    quantity: true,
};
class CartMutationConflictError extends Error {
    constructor() {
        super("Cart mutation could not be applied");
        this.name = "CartMutationConflictError";
    }
}
exports.CartMutationConflictError = CartMutationConflictError;
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
class CartRepository {
    findOrCreateActive(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                yield lockCustomer(tx, customerId);
                const existing = yield tx.cart.findFirst({
                    where: { customerId, status: client_1.CartStatus.ACTIVE },
                    select: { id: true },
                });
                if (existing)
                    return existing.id;
                const cart = yield tx.cart.create({
                    data: { customerId, status: client_1.CartStatus.ACTIVE },
                    select: { id: true },
                });
                return cart.id;
            }));
        });
    }
    findActiveCart(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.cart.findFirst({
                where: { customerId, status: client_1.CartStatus.ACTIVE },
                select: CART_SELECT,
            });
        });
    }
    addItem(customerId, productId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                yield lockCustomer(tx, customerId);
                let cart = yield tx.cart.findFirst({
                    where: { customerId, status: client_1.CartStatus.ACTIVE },
                    select: { id: true },
                });
                if (!cart) {
                    cart = yield tx.cart.create({
                        data: { customerId, status: client_1.CartStatus.ACTIVE },
                        select: { id: true },
                    });
                }
                const rows = yield tx.$queryRaw(client_1.Prisma.sql `
        INSERT INTO "cart_item" ("id", "cartId", "productId", "quantity", "createdAt", "updatedAt")
        SELECT ${(0, crypto_1.randomUUID)()}, c."id", p."id", ${quantity}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM "cart" c
        INNER JOIN "product" p ON p."id" = ${productId}
        INNER JOIN "seller" s ON s."id" = p."sellerId"
        INNER JOIN "inventory" i ON i."productId" = p."id"
        WHERE c."id" = ${cart.id}
          AND c."status" = CAST(${client_1.CartStatus.ACTIVE} AS "CartStatus")
          AND p."isActive" = true
          AND s."isActive" = true
          AND i."onHandQuantity" - i."reservedQuantity" >= ${quantity}
        ON CONFLICT ("cartId", "productId") DO UPDATE
        SET "quantity" = "cart_item"."quantity" + EXCLUDED."quantity",
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE EXISTS (
          SELECT 1
          FROM "inventory" available_inventory
          WHERE available_inventory."productId" = "cart_item"."productId"
            AND available_inventory."onHandQuantity" - available_inventory."reservedQuantity"
              >= "cart_item"."quantity" + EXCLUDED."quantity"
        )
        RETURNING "id", "productId", "quantity"
      `);
                if (!rows[0])
                    throw new CartMutationConflictError();
                return rows[0];
            }));
        });
    }
    updateItem(customerId, productId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const rows = yield db_1.default.$queryRaw(client_1.Prisma.sql `
      UPDATE "cart_item" ci
      SET "quantity" = ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
      FROM "cart" c, "product" p, "seller" s, "inventory" i
      WHERE ci."cartId" = c."id"
        AND p."id" = ci."productId"
        AND s."id" = p."sellerId"
        AND i."productId" = p."id"
        AND c."customerId" = ${customerId}
        AND c."status" = CAST(${client_1.CartStatus.ACTIVE} AS "CartStatus")
        AND ci."productId" = ${productId}
        AND p."isActive" = true
        AND s."isActive" = true
        AND i."onHandQuantity" - i."reservedQuantity" >= ${quantity}
      RETURNING ci."id", ci."productId", ci."quantity"
    `);
            return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
    removeItem(customerId, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield db_1.default.cartItem.deleteMany({
                where: {
                    productId,
                    cart: { customerId, status: client_1.CartStatus.ACTIVE },
                },
            });
            return result.count > 0;
        });
    }
    clear(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield db_1.default.cartItem.deleteMany({
                where: { cart: { customerId, status: client_1.CartStatus.ACTIVE } },
            });
        });
    }
}
exports.CartRepository = CartRepository;
exports.cartRepository = new CartRepository();
