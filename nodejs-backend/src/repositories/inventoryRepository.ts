import { InventoryMovementType, Prisma } from "@prisma/client";
import prisma from "../config/db";

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
} satisfies Prisma.InventorySelect;

type InventoryAuthorizationRow = Prisma.InventoryGetPayload<{
  select: typeof INVENTORY_AUTH_SELECT;
}>;

export type InventoryAuthorizationRecord = {
  inventoryId: string;
  productId: string;
  productIsActive: boolean;
  sellerId: string;
  sellerUserId: string;
  sellerIsActive: boolean;
  onHandQuantity: number;
  reservedQuantity: number;
};

export type InventorySnapshot = {
  productId: string;
  onHandQuantity: number;
  reservedQuantity: number;
};

export type InventoryMovementRecord = {
  id: string;
  inventoryId: string;
  orderItemId: string | null;
  movementType: InventoryMovementType;
  onHandDelta: number;
  reservedDelta: number;
  onHandAfter: number;
  reservedAfter: number;
  reason: string | null;
  createdAt: Date;
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
} satisfies Prisma.InventoryMovementSelect;

type UpdatedInventoryRow = {
  onHandQuantity: number;
  reservedQuantity: number;
};

function mapAuthorization(row: InventoryAuthorizationRow): InventoryAuthorizationRecord {
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

export class InventoryRepository {
  async findByProductForAuthorization(productId: string): Promise<InventoryAuthorizationRecord | null> {
    const row = await prisma.inventory.findUnique({
      where: { productId },
      select: INVENTORY_AUTH_SELECT,
    });
    return row ? mapAuthorization(row) : null;
  }

  async findSnapshotByProduct(productId: string): Promise<InventorySnapshot | null> {
    const row = await prisma.inventory.findUnique({
      where: { productId },
      select: { productId: true, onHandQuantity: true, reservedQuantity: true },
    });
    return row;
  }

  async applyOnHandMovement(
    inventoryId: string,
    movementType: InventoryMovementType,
    onHandDelta: number,
    reason: string | null
  ): Promise<InventoryMovementRecord | null> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.$queryRaw<UpdatedInventoryRow[]>(Prisma.sql`
        UPDATE "inventory"
        SET "onHandQuantity" = "onHandQuantity" + ${onHandDelta},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${inventoryId}
          AND "onHandQuantity" + ${onHandDelta} >= 0
          AND "onHandQuantity" + ${onHandDelta} >= "reservedQuantity"
        RETURNING "onHandQuantity", "reservedQuantity"
      `);

      if (updated.length === 0) return null;
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
    });
  }

  async findMovements(
    inventoryId: string,
    skip: number,
    take: number
  ): Promise<{ total: number; data: InventoryMovementRecord[] }> {
    const where = { inventoryId };
    const [total, data] = await prisma.$transaction([
      prisma.inventoryMovement.count({ where }),
      prisma.inventoryMovement.findMany({
        where,
        select: MOVEMENT_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
    ]);
    return { total, data };
  }
}

export const inventoryRepository = new InventoryRepository();
