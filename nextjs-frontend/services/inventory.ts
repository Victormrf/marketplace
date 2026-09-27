import { browserRequest } from "@/lib/http";

export type InventoryDto = {
  productId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
};

export type InventoryMovementDto = {
  id: string;
  inventoryId: string;
  orderItemId: string | null;
  movementType: string;
  onHandDelta: number;
  reservedDelta: number;
  onHandAfter: number;
  reservedAfter: number;
  reason: string | null;
  createdAt: string;
};

export type InventoryMovementCollectionDto = {
  data: InventoryMovementDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type InventoryMovementInput = { page: number; limit: number };

export function getInventory(productId: string) {
  return browserRequest<InventoryDto>(
    `/api/inventory/products/${encodeURIComponent(productId)}`,
  );
}

export function listInventoryMovements(
  productId: string,
  input: InventoryMovementInput,
) {
  const query = new URLSearchParams({
    page: String(input.page),
    limit: String(input.limit),
  });

  return browserRequest<InventoryMovementCollectionDto>(
    `/api/inventory/products/${encodeURIComponent(productId)}/movements?${query}`,
  );
}

export function restockInventory(
  productId: string,
  quantity: number,
  reason?: string,
) {
  return browserRequest<InventoryDto>(
    `/api/inventory/products/${encodeURIComponent(productId)}/restock`,
    { method: "POST", json: { quantity, ...(reason ? { reason } : {}) } },
  );
}

export function adjustInventory(
  productId: string,
  onHandDelta: number,
  reason: string,
) {
  return browserRequest<InventoryDto>(
    `/api/inventory/products/${encodeURIComponent(productId)}/adjustments`,
    { method: "POST", json: { onHandDelta, reason } },
  );
}
