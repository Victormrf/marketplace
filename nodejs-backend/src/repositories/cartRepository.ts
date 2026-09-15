import { CartStatus, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import prisma from "../config/db";

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
} satisfies Prisma.CartSelect;

export type CartReadRecord = Prisma.CartGetPayload<{ select: typeof CART_SELECT }>;

const CART_ITEM_SELECT = {
  id: true,
  productId: true,
  quantity: true,
} satisfies Prisma.CartItemSelect;

export type CartItemRecord = Prisma.CartItemGetPayload<{ select: typeof CART_ITEM_SELECT }>;

type AtomicCartItemRow = { id: string; productId: string; quantity: number };

export class CartMutationConflictError extends Error {
  constructor() {
    super("Cart mutation could not be applied");
    this.name = "CartMutationConflictError";
  }
}

async function lockCustomer(tx: Prisma.TransactionClient, customerId: string): Promise<void> {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id"
    FROM "customer"
    WHERE "id" = ${customerId}
    FOR UPDATE
  `);
}

export class CartRepository {
  async findOrCreateActive(customerId: string): Promise<string> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockCustomer(tx, customerId);
      const existing = await tx.cart.findFirst({
        where: { customerId, status: CartStatus.ACTIVE },
        select: { id: true },
      });
      if (existing) return existing.id;
      const cart = await tx.cart.create({
        data: { customerId, status: CartStatus.ACTIVE },
        select: { id: true },
      });
      return cart.id;
    });
  }

  async findActiveCart(customerId: string): Promise<CartReadRecord | null> {
    return prisma.cart.findFirst({
      where: { customerId, status: CartStatus.ACTIVE },
      select: CART_SELECT,
    });
  }

  async addItem(customerId: string, productId: string, quantity: number): Promise<AtomicCartItemRow | null> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockCustomer(tx, customerId);
      let cart = await tx.cart.findFirst({
        where: { customerId, status: CartStatus.ACTIVE },
        select: { id: true },
      });
      if (!cart) {
        cart = await tx.cart.create({
          data: { customerId, status: CartStatus.ACTIVE },
          select: { id: true },
        });
      }

      const rows = await tx.$queryRaw<AtomicCartItemRow[]>(Prisma.sql`
        INSERT INTO "cart_item" ("id", "cartId", "productId", "quantity", "createdAt", "updatedAt")
        SELECT ${randomUUID()}, c."id", p."id", ${quantity}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM "cart" c
        INNER JOIN "product" p ON p."id" = ${productId}
        INNER JOIN "seller" s ON s."id" = p."sellerId"
        INNER JOIN "inventory" i ON i."productId" = p."id"
        WHERE c."id" = ${cart.id}
          AND c."status" = CAST(${CartStatus.ACTIVE} AS "CartStatus")
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
      if (!rows[0]) throw new CartMutationConflictError();
      return rows[0];
    });
  }

  async updateItem(customerId: string, productId: string, quantity: number): Promise<AtomicCartItemRow | null> {
    const rows = await prisma.$queryRaw(Prisma.sql`
      UPDATE "cart_item" ci
      SET "quantity" = ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
      FROM "cart" c, "product" p, "seller" s, "inventory" i
      WHERE ci."cartId" = c."id"
        AND p."id" = ci."productId"
        AND s."id" = p."sellerId"
        AND i."productId" = p."id"
        AND c."customerId" = ${customerId}
        AND c."status" = CAST(${CartStatus.ACTIVE} AS "CartStatus")
        AND ci."productId" = ${productId}
        AND p."isActive" = true
        AND s."isActive" = true
        AND i."onHandQuantity" - i."reservedQuantity" >= ${quantity}
      RETURNING ci."id", ci."productId", ci."quantity"
    `) as AtomicCartItemRow[];
    return rows[0] ?? null;
  }

  async removeItem(customerId: string, productId: string): Promise<boolean> {
    const result = await prisma.cartItem.deleteMany({
      where: {
        productId,
        cart: { customerId, status: CartStatus.ACTIVE },
      },
    });
    return result.count > 0;
  }

  async clear(customerId: string): Promise<void> {
    await prisma.cartItem.deleteMany({
      where: { cart: { customerId, status: CartStatus.ACTIVE } },
    });
  }
}

export const cartRepository = new CartRepository();
