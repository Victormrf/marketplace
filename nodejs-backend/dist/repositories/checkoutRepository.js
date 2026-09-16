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
exports.checkoutRepository = exports.CheckoutRepository = exports.CheckoutConflictError = exports.CheckoutNotFoundError = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const db_1 = __importDefault(require("../config/db"));
const CHECKOUT_SELECT = {
    id: true,
    status: true,
    subtotalInCents: true,
    shippingInCents: true,
    taxInCents: true,
    discountInCents: true,
    totalInCents: true,
    currency: true,
    createdAt: true,
    updatedAt: true,
    address: { select: {
            id: true, sourceAddressId: true, recipientName: true, postalCode: true, street: true,
            number: true, complement: true, neighborhood: true, city: true, state: true,
            countryCode: true, phone: true, createdAt: true,
        } },
    sellerOrders: { orderBy: { id: "asc" }, select: {
            id: true, sellerId: true, status: true, subtotalInCents: true, shippingInCents: true,
            taxInCents: true, discountInCents: true, totalInCents: true, currency: true,
            items: { orderBy: { id: "asc" }, select: {
                    id: true, productId: true, quantity: true, unitPriceInCents: true,
                    lineTotalInCents: true, currency: true, productNameSnapshot: true,
                    productReferenceSnapshot: true, sellerNameSnapshot: true,
                    inventoryReservation: { select: { id: true, status: true, quantity: true, expiresAt: true } },
                } },
        } },
};
class CheckoutNotFoundError extends Error {
}
exports.CheckoutNotFoundError = CheckoutNotFoundError;
class CheckoutConflictError extends Error {
}
exports.CheckoutConflictError = CheckoutConflictError;
function lockCustomer(tx, customerId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield tx.$queryRaw(client_1.Prisma.sql `
    SELECT "id" FROM "customer" WHERE "id" = ${customerId} FOR UPDATE
  `);
    });
}
class CheckoutRepository {
    constructor(hooks = {}) {
        this.hooks = hooks;
    }
    createFromActiveCart(customerId, addressId) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => this.createCheckoutInTransaction(tx, customerId, addressId));
        });
    }
    createIdempotentCheckout(args) {
        return __awaiter(this, void 0, void 0, function* () {
            return db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const inserted = yield tx.$queryRaw(client_1.Prisma.sql `
        INSERT INTO "idempotency_key" ("id", "userId", "operation", "key", "requestFingerprint", "status", "expiresAt", "createdAt", "updatedAt")
        VALUES (${(0, crypto_1.randomUUID)()}, ${args.userId}, ${args.operation}, ${args.key}, ${args.requestFingerprint}, CAST('PROCESSING' AS "IdempotencyStatus"), ${args.expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId", "operation", "key") DO NOTHING
        RETURNING "id", "status", "requestFingerprint", "result", "orderId"
      `);
                if (!inserted[0]) {
                    const existing = yield tx.idempotencyKey.findFirst({
                        where: { userId: args.userId, operation: args.operation, key: args.key },
                        select: { status: true, requestFingerprint: true, result: true, orderId: true },
                    });
                    if (!existing || existing.requestFingerprint !== args.requestFingerprint)
                        throw new CheckoutConflictError("Idempotency key was used with a different request");
                    if (existing.status === "COMPLETED" && existing.result !== null)
                        return { result: existing.result, replayed: true };
                    throw new CheckoutConflictError(`Idempotency key is ${existing.status.toLowerCase()}`);
                }
                const record = yield this.createCheckoutInTransaction(tx, args.customerId, args.addressId);
                const result = args.serialize(record);
                yield tx.idempotencyKey.update({
                    where: { id: inserted[0].id },
                    data: { status: "COMPLETED", orderId: record.id, result: result, completedAt: new Date() },
                });
                return { result, replayed: false };
            }));
        });
    }
    createCheckoutInTransaction(tx, customerId, addressId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            yield lockCustomer(tx, customerId);
            const cart = yield tx.cart.findFirst({
                where: { customerId, status: client_1.CartStatus.ACTIVE },
                select: {
                    id: true,
                    items: {
                        orderBy: [{ productId: "asc" }, { id: "asc" }],
                        select: {
                            id: true, productId: true, quantity: true,
                        },
                    },
                },
            });
            if (!cart)
                throw new CheckoutNotFoundError("Active cart not found");
            if (cart.items.length === 0)
                throw new CheckoutConflictError("Cart is empty");
            const addresses = yield tx.$queryRaw(client_1.Prisma.sql `
        SELECT "id", "recipientName", "postalCode", "street", "number", "complement", "neighborhood", "city", "state", "countryCode", "phone"
        FROM "customer_address"
        WHERE "id" = ${addressId} AND "customerId" = ${customerId} AND "isActive" = true
        FOR SHARE
      `);
            const address = addresses[0];
            if (!address)
                throw new CheckoutNotFoundError("Address not found");
            const productIds = [...new Set(cart.items.map((item) => item.productId))].sort();
            const lockedProducts = yield tx.$queryRaw(client_1.Prisma.sql `
        SELECT "id", "sellerId", "name", "reference", "priceInCents", "currency", "isActive"
        FROM "product"
        WHERE "id" IN (${client_1.Prisma.join(productIds)})
        ORDER BY "id" ASC
        FOR SHARE
      `);
            if (lockedProducts.length !== productIds.length)
                throw new CheckoutConflictError("Cart contains a missing product");
            const productById = new Map(lockedProducts.map((product) => [product.id, product]));
            const sellerIds = [...new Set(lockedProducts.map((product) => product.sellerId))].sort();
            const lockedSellers = yield tx.$queryRaw(client_1.Prisma.sql `
        SELECT "id", "storeName", "isActive"
        FROM "seller"
        WHERE "id" IN (${client_1.Prisma.join(sellerIds)})
        ORDER BY "id" ASC
        FOR SHARE
      `);
            if (lockedSellers.length !== sellerIds.length)
                throw new CheckoutConflictError("Cart contains a missing seller");
            const sellerById = new Map(lockedSellers.map((seller) => [seller.id, seller]));
            const productFor = (productId) => {
                const product = productById.get(productId);
                if (!product)
                    throw new CheckoutConflictError("Cart contains a missing product");
                return product;
            };
            const sellerFor = (sellerId) => {
                const seller = sellerById.get(sellerId);
                if (!seller)
                    throw new CheckoutConflictError("Cart contains a missing seller");
                return seller;
            };
            // Checkpoint opcional após os locks compartilhados e antes do lock de Inventory.
            yield ((_b = (_a = this.hooks).afterSharedLocks) === null || _b === void 0 ? void 0 : _b.call(_a));
            const lockedInventories = yield tx.$queryRaw(client_1.Prisma.sql `
        SELECT "id", "productId", "onHandQuantity", "reservedQuantity"
        FROM "inventory"
        WHERE "productId" IN (${client_1.Prisma.join(productIds)})
        ORDER BY "id" ASC
        FOR UPDATE
      `);
            const inventoryByProductId = new Map(lockedInventories.map((inventory) => [inventory.productId, inventory]));
            // Hook exclusivo para coordenação determinística de testes; produção não injeta hooks.
            yield ((_d = (_c = this.hooks).afterLocks) === null || _d === void 0 ? void 0 : _d.call(_c));
            for (const item of cart.items) {
                if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0)
                    throw new CheckoutConflictError("Cart quantity is invalid");
                const product = productById.get(item.productId);
                const seller = product ? sellerById.get(product.sellerId) : undefined;
                const inventory = inventoryByProductId.get(item.productId);
                if (!product || !seller || !product.isActive || !seller.isActive || !inventory) {
                    throw new CheckoutConflictError("Cart contains an unavailable product");
                }
                if (product.currency !== client_1.Currency.BRL || inventory.onHandQuantity - inventory.reservedQuantity < item.quantity) {
                    throw new CheckoutConflictError("Cart stock is insufficient");
                }
            }
            const subtotalInCents = cart.items.reduce((sum, item) => sum + item.quantity * productFor(item.productId).priceInCents, 0);
            const order = yield tx.order.create({
                data: {
                    customerId, status: client_1.OrderStatus.PENDING_PAYMENT, currency: client_1.Currency.BRL,
                    subtotalInCents, shippingInCents: 0, taxInCents: 0, discountInCents: 0, totalInCents: subtotalInCents,
                }, select: { id: true },
            });
            const grouped = new Map();
            for (const item of cart.items) {
                const sellerId = productFor(item.productId).sellerId;
                const list = (_e = grouped.get(sellerId)) !== null && _e !== void 0 ? _e : [];
                list.push(item);
                grouped.set(sellerId, list);
            }
            for (const [sellerId, items] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
                const sellerSubtotal = items.reduce((sum, item) => sum + item.quantity * productFor(item.productId).priceInCents, 0);
                const sellerOrder = yield tx.sellerOrder.create({
                    data: {
                        orderId: order.id, sellerId, status: client_1.SellerOrderStatus.PENDING, currency: client_1.Currency.BRL,
                        subtotalInCents: sellerSubtotal, shippingInCents: 0, taxInCents: 0, discountInCents: 0, totalInCents: sellerSubtotal,
                    }, select: { id: true },
                });
                yield tx.sellerOrderStatusHistory.create({ data: { sellerOrderId: sellerOrder.id, toStatus: client_1.SellerOrderStatus.PENDING, reason: "Checkout" } });
                for (const item of items) {
                    const product = productFor(item.productId);
                    const seller = sellerFor(product.sellerId);
                    const inventory = inventoryByProductId.get(item.productId);
                    const lineTotalInCents = item.quantity * product.priceInCents;
                    const orderItem = yield tx.orderItem.create({
                        data: {
                            sellerOrderId: sellerOrder.id, productId: item.productId, quantity: item.quantity,
                            unitPriceInCents: product.priceInCents, lineTotalInCents, currency: product.currency,
                            productNameSnapshot: product.name, productReferenceSnapshot: product.reference,
                            sellerNameSnapshot: seller.storeName,
                        }, select: { id: true },
                    });
                    if (!inventory)
                        throw new CheckoutConflictError("Inventory disappeared during checkout");
                    const reservedAfter = inventory.reservedQuantity + item.quantity;
                    yield tx.inventory.update({ where: { id: inventory.id }, data: { reservedQuantity: { increment: item.quantity } } });
                    yield tx.inventoryReservation.create({
                        data: {
                            inventoryId: inventory.id, orderItemId: orderItem.id, quantity: item.quantity,
                            status: client_1.InventoryReservationStatus.ACTIVE,
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                        }, select: { id: true },
                    });
                    yield tx.inventoryMovement.create({
                        data: {
                            inventoryId: inventory.id, orderItemId: orderItem.id, movementType: client_1.InventoryMovementType.RESERVATION,
                            onHandDelta: 0, reservedDelta: item.quantity, onHandAfter: inventory.onHandQuantity,
                            reservedAfter, reason: "Checkout inventory reservation",
                        }, select: { id: true },
                    });
                    yield ((_g = (_f = this.hooks).afterFirstOrderItem) === null || _g === void 0 ? void 0 : _g.call(_f));
                }
            }
            yield tx.orderAddress.create({
                data: {
                    orderId: order.id,
                    sourceAddressId: address.id,
                    recipientName: address.recipientName,
                    postalCode: address.postalCode,
                    street: address.street,
                    number: address.number,
                    complement: address.complement,
                    neighborhood: address.neighborhood,
                    city: address.city,
                    state: address.state,
                    countryCode: address.countryCode,
                    phone: address.phone,
                },
            });
            yield tx.orderStatusHistory.create({ data: { orderId: order.id, toStatus: client_1.OrderStatus.PENDING_PAYMENT, reason: "Checkout" } });
            yield tx.cart.update({ where: { id: cart.id }, data: { status: client_1.CartStatus.CONVERTED, convertedAt: new Date() } });
            return tx.order.findUniqueOrThrow({ where: { id: order.id }, select: CHECKOUT_SELECT });
        });
    }
}
exports.CheckoutRepository = CheckoutRepository;
exports.checkoutRepository = new CheckoutRepository();
