import {
  CartStatus,
  Currency,
  InventoryMovementType,
  InventoryReservationStatus,
  OrderStatus,
  Prisma,
  SellerOrderStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import prisma from "../config/db";

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
} satisfies Prisma.OrderSelect;

export type CheckoutReadRecord = Prisma.OrderGetPayload<{ select: typeof CHECKOUT_SELECT }>;

type CartCheckoutItem = {
  id: string;
  productId: string;
  quantity: number;
};

type LockedProduct = { id: string; sellerId: string; name: string; reference: string | null; priceInCents: number; currency: Currency; isActive: boolean };
type LockedSeller = { id: string; storeName: string; isActive: boolean };
type LockedInventory = { id: string; productId: string; onHandQuantity: number; reservedQuantity: number };

export class CheckoutNotFoundError extends Error {}
export class CheckoutConflictError extends Error {}
export type CheckoutTestHooks = { afterSharedLocks?: () => Promise<void>; afterLocks?: () => Promise<void>; afterFirstOrderItem?: () => Promise<void> };
export type CheckoutIdempotencyExecution<T extends Prisma.JsonValue = Prisma.JsonValue> = { result: T; replayed: boolean };
type IdempotencyRow = { id: string; status: string; requestFingerprint: string; result: Prisma.JsonValue | null; orderId: string | null };

async function lockCustomer(tx: Prisma.TransactionClient, customerId: string): Promise<void> {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "customer" WHERE "id" = ${customerId} FOR UPDATE
  `);
}

export class CheckoutRepository {
  constructor(private readonly hooks: CheckoutTestHooks = {}) {}

  async createFromActiveCart(customerId: string, addressId: string): Promise<CheckoutReadRecord> {
    return prisma.$transaction((tx: Prisma.TransactionClient) => this.createCheckoutInTransaction(tx, customerId, addressId));
  }

  async createIdempotentCheckout<T extends Prisma.JsonValue>(args: {
    userId: string;
    customerId: string;
    addressId: string;
    operation: string;
    key: string;
    requestFingerprint: string;
    expiresAt: Date;
    serialize: (record: CheckoutReadRecord) => T;
  }): Promise<CheckoutIdempotencyExecution<T>> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const inserted = await tx.$queryRaw<IdempotencyRow[]>(Prisma.sql`
        INSERT INTO "idempotency_key" ("id", "userId", "operation", "key", "requestFingerprint", "status", "expiresAt", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${args.userId}, ${args.operation}, ${args.key}, ${args.requestFingerprint}, CAST('PROCESSING' AS "IdempotencyStatus"), ${args.expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId", "operation", "key") DO NOTHING
        RETURNING "id", "status", "requestFingerprint", "result", "orderId"
      `);
      if (!inserted[0]) {
        const existing = await tx.idempotencyKey.findFirst({
          where: { userId: args.userId, operation: args.operation, key: args.key },
          select: { status: true, requestFingerprint: true, result: true, orderId: true },
        });
        if (!existing || existing.requestFingerprint !== args.requestFingerprint) throw new CheckoutConflictError("Idempotency key was used with a different request");
        if (existing.status === "COMPLETED" && existing.result !== null) return { result: existing.result as T, replayed: true };
        throw new CheckoutConflictError(`Idempotency key is ${existing.status.toLowerCase()}`);
      }
      const record = await this.createCheckoutInTransaction(tx, args.customerId, args.addressId);
      const result = args.serialize(record);
      await tx.idempotencyKey.update({
        where: { id: inserted[0].id },
        data: { status: "COMPLETED", orderId: record.id, result: result as Prisma.InputJsonValue, completedAt: new Date() },
      });
      return { result, replayed: false };
    });
  }

  private async createCheckoutInTransaction(tx: Prisma.TransactionClient, customerId: string, addressId: string): Promise<CheckoutReadRecord> {
      await lockCustomer(tx, customerId);

      const cart = await tx.cart.findFirst({
        where: { customerId, status: CartStatus.ACTIVE },
        select: {
          id: true,
          items: {
            orderBy: [{ productId: "asc" }, { id: "asc" }],
            select: {
              id: true, productId: true, quantity: true,
            },
          },
        },
      }) as ({ id: string; items: CartCheckoutItem[] } | null);
      if (!cart) throw new CheckoutNotFoundError("Active cart not found");
      if (cart.items.length === 0) throw new CheckoutConflictError("Cart is empty");

      const addresses = await tx.$queryRaw<Array<{
        id: string; recipientName: string; postalCode: string; street: string; number: string;
        complement: string | null; neighborhood: string; city: string; state: string; countryCode: string; phone: string | null;
      }>>(Prisma.sql`
        SELECT "id", "recipientName", "postalCode", "street", "number", "complement", "neighborhood", "city", "state", "countryCode", "phone"
        FROM "customer_address"
        WHERE "id" = ${addressId} AND "customerId" = ${customerId} AND "isActive" = true
        FOR SHARE
      `);
      const address = addresses[0];
      if (!address) throw new CheckoutNotFoundError("Address not found");

      const productIds = [...new Set(cart.items.map((item) => item.productId))].sort();
      const lockedProducts = await tx.$queryRaw<LockedProduct[]>(Prisma.sql`
        SELECT "id", "sellerId", "name", "reference", "priceInCents", "currency", "isActive"
        FROM "product"
        WHERE "id" IN (${Prisma.join(productIds)})
        ORDER BY "id" ASC
        FOR SHARE
      `);
      if (lockedProducts.length !== productIds.length) throw new CheckoutConflictError("Cart contains a missing product");
      const productById = new Map(lockedProducts.map((product) => [product.id, product]));
      const sellerIds = [...new Set(lockedProducts.map((product) => product.sellerId))].sort();
      const lockedSellers = await tx.$queryRaw<LockedSeller[]>(Prisma.sql`
        SELECT "id", "storeName", "isActive"
        FROM "seller"
        WHERE "id" IN (${Prisma.join(sellerIds)})
        ORDER BY "id" ASC
        FOR SHARE
      `);
      if (lockedSellers.length !== sellerIds.length) throw new CheckoutConflictError("Cart contains a missing seller");
      const sellerById = new Map(lockedSellers.map((seller) => [seller.id, seller]));
      const productFor = (productId: string): LockedProduct => {
        const product = productById.get(productId);
        if (!product) throw new CheckoutConflictError("Cart contains a missing product");
        return product;
      };
      const sellerFor = (sellerId: string): LockedSeller => {
        const seller = sellerById.get(sellerId);
        if (!seller) throw new CheckoutConflictError("Cart contains a missing seller");
        return seller;
      };

      // Checkpoint opcional após os locks compartilhados e antes do lock de Inventory.
      await this.hooks.afterSharedLocks?.();

      const lockedInventories = await tx.$queryRaw<LockedInventory[]>(Prisma.sql`
        SELECT "id", "productId", "onHandQuantity", "reservedQuantity"
        FROM "inventory"
        WHERE "productId" IN (${Prisma.join(productIds)})
        ORDER BY "id" ASC
        FOR UPDATE
      `);
      const inventoryByProductId = new Map(lockedInventories.map((inventory) => [inventory.productId, inventory]));
      // Hook exclusivo para coordenação determinística de testes; produção não injeta hooks.
      await this.hooks.afterLocks?.();

      for (const item of cart.items) {
        if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new CheckoutConflictError("Cart quantity is invalid");
        const product = productById.get(item.productId);
        const seller = product ? sellerById.get(product.sellerId) : undefined;
        const inventory = inventoryByProductId.get(item.productId);
        if (!product || !seller || !product.isActive || !seller.isActive || !inventory) {
          throw new CheckoutConflictError("Cart contains an unavailable product");
        }
        if (product.currency !== Currency.BRL || inventory.onHandQuantity - inventory.reservedQuantity < item.quantity) {
          throw new CheckoutConflictError("Cart stock is insufficient");
        }
      }

      const subtotalInCents = cart.items.reduce((sum, item) => sum + item.quantity * productFor(item.productId).priceInCents, 0);
      const order = await tx.order.create({
        data: {
          customerId, status: OrderStatus.PENDING_PAYMENT, currency: Currency.BRL,
          subtotalInCents, shippingInCents: 0, taxInCents: 0, discountInCents: 0, totalInCents: subtotalInCents,
        }, select: { id: true },
      });

      const grouped = new Map<string, CartCheckoutItem[]>();
      for (const item of cart.items) {
        const sellerId = productFor(item.productId).sellerId;
        const list = grouped.get(sellerId) ?? [];
        list.push(item); grouped.set(sellerId, list);
      }
      for (const [sellerId, items] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const sellerSubtotal = items.reduce((sum, item) => sum + item.quantity * productFor(item.productId).priceInCents, 0);
        const sellerOrder = await tx.sellerOrder.create({
          data: {
            orderId: order.id, sellerId, status: SellerOrderStatus.PENDING, currency: Currency.BRL,
            subtotalInCents: sellerSubtotal, shippingInCents: 0, taxInCents: 0, discountInCents: 0, totalInCents: sellerSubtotal,
          }, select: { id: true },
        });
        await tx.sellerOrderStatusHistory.create({ data: { sellerOrderId: sellerOrder.id, toStatus: SellerOrderStatus.PENDING, reason: "Checkout" } });
        for (const item of items) {
          const product = productFor(item.productId);
          const seller = sellerFor(product.sellerId);
          const inventory = inventoryByProductId.get(item.productId);
          const lineTotalInCents = item.quantity * product.priceInCents;
          const orderItem = await tx.orderItem.create({
            data: {
              sellerOrderId: sellerOrder.id, productId: item.productId, quantity: item.quantity,
              unitPriceInCents: product.priceInCents, lineTotalInCents, currency: product.currency,
              productNameSnapshot: product.name, productReferenceSnapshot: product.reference,
              sellerNameSnapshot: seller.storeName,
            }, select: { id: true },
          });
          if (!inventory) throw new CheckoutConflictError("Inventory disappeared during checkout");
          const reservedAfter = inventory.reservedQuantity + item.quantity;
          await tx.inventory.update({ where: { id: inventory.id }, data: { reservedQuantity: { increment: item.quantity } } });
          await tx.inventoryReservation.create({
            data: {
              inventoryId: inventory.id, orderItemId: orderItem.id, quantity: item.quantity,
              status: InventoryReservationStatus.ACTIVE,
              expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            }, select: { id: true },
          });
          await tx.inventoryMovement.create({
            data: {
              inventoryId: inventory.id, orderItemId: orderItem.id, movementType: InventoryMovementType.RESERVATION,
              onHandDelta: 0, reservedDelta: item.quantity, onHandAfter: inventory.onHandQuantity,
              reservedAfter, reason: "Checkout inventory reservation",
            }, select: { id: true },
          });
          await this.hooks.afterFirstOrderItem?.();
        }
      }
      await tx.orderAddress.create({
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
      await tx.orderStatusHistory.create({ data: { orderId: order.id, toStatus: OrderStatus.PENDING_PAYMENT, reason: "Checkout" } });
      await tx.cart.update({ where: { id: cart.id }, data: { status: CartStatus.CONVERTED, convertedAt: new Date() } });
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, select: CHECKOUT_SELECT });
  }
}

export const checkoutRepository = new CheckoutRepository();
