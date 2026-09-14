import { InventoryMovementType } from "@prisma/client";
import {
  InventoryAuthorizationRecord,
  InventoryMovementRecord,
  InventoryRepository,
  InventorySnapshot,
  inventoryRepository,
} from "../repositories/inventoryRepository";
import { ConflictError, ObjectNotFoundError, ValidationError } from "../utils/customErrors";
import { PaginationInput } from "../types/productRead";

export type InventoryActor = { id: string; role?: string };
export type RestockInput = Record<string, unknown>;
export type AdjustmentInput = Record<string, unknown>;

export type InventoryDto = {
  productId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
};

export type InventoryMovementDto = InventoryMovementRecord;

export class InventoryForbiddenError extends Error {
  constructor() {
    super("You do not have permission to manage this inventory");
    this.name = "InventoryForbiddenError";
  }
}

function toDto(snapshot: InventorySnapshot): InventoryDto {
  return {
    productId: snapshot.productId,
    onHandQuantity: snapshot.onHandQuantity,
    reservedQuantity: snapshot.reservedQuantity,
    availableQuantity: snapshot.onHandQuantity - snapshot.reservedQuantity,
  };
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return value as number;
}

function nonZeroInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || value === 0) {
    throw new ValidationError(`${field} must be a non-zero integer`);
  }
  return value as number;
}

function requiredReason(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError("reason is required");
  }
  return value.trim();
}

export class InventoryService {
  constructor(private readonly repository: InventoryRepository = inventoryRepository) {}

  private async authorize(productId: string, actor: InventoryActor): Promise<InventoryAuthorizationRecord> {
    const record = await this.repository.findByProductForAuthorization(productId);
    if (!record || !record.productIsActive || !record.sellerIsActive) {
      throw new ObjectNotFoundError("Product or inventory");
    }
    if (actor.role === "ADMIN") return record;
    if (actor.role !== "SELLER" || record.sellerUserId !== actor.id) {
      throw new InventoryForbiddenError();
    }
    return record;
  }

  async getInventory(productId: string, actor: InventoryActor): Promise<InventoryDto> {
    const record = await this.authorize(productId, actor);
    return toDto(record);
  }

  async restock(productId: string, actor: InventoryActor, input: RestockInput): Promise<InventoryDto> {
    const quantity = positiveInteger(input.quantity, "quantity");
    const reason = input.reason === undefined ? null : requiredReason(input.reason);
    const record = await this.authorize(productId, actor);
    const movement = await this.repository.applyOnHandMovement(
      record.inventoryId,
      InventoryMovementType.RESTOCK,
      quantity,
      reason
    );
    if (!movement) throw new ConflictError("Inventory movement cannot be applied");
    return toDto({ productId, onHandQuantity: movement.onHandAfter, reservedQuantity: movement.reservedAfter });
  }

  async adjust(productId: string, actor: InventoryActor, input: AdjustmentInput): Promise<InventoryDto> {
    const onHandDelta = nonZeroInteger(input.onHandDelta, "onHandDelta");
    const reason = requiredReason(input.reason);
    const record = await this.authorize(productId, actor);
    const movement = await this.repository.applyOnHandMovement(
      record.inventoryId,
      InventoryMovementType.MANUAL_CORRECTION,
      onHandDelta,
      reason
    );
    if (!movement) throw new ConflictError("Inventory movement cannot be applied");
    return toDto({ productId, onHandQuantity: movement.onHandAfter, reservedQuantity: movement.reservedAfter });
  }

  async listMovements(productId: string, actor: InventoryActor, pagination: PaginationInput) {
    const record = await this.authorize(productId, actor);
    const result = await this.repository.findMovements(
      record.inventoryId,
      (pagination.page - 1) * pagination.limit,
      pagination.limit
    );
    return {
      data: result.data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit),
      },
    };
  }
}

export const inventoryService = new InventoryService();
