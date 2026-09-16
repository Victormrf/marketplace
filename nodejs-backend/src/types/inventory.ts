import type { InventoryMovementType } from "@prisma/client";

export type InventoryActor = { id: string; role?: string };
export type RestockInput = Record<string, unknown>;
export type AdjustmentInput = Record<string, unknown>;
export type InventoryDto = { productId: string; onHandQuantity: number; reservedQuantity: number; availableQuantity: number };
export type InventoryMovementDto = {
  id: string; inventoryId: string; orderItemId: string | null; movementType: InventoryMovementType;
  onHandDelta: number; reservedDelta: number; onHandAfter: number; reservedAfter: number; reason: string | null; createdAt: Date;
};
export type InventoryMovementCollectionDto = {
  data: InventoryMovementDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
