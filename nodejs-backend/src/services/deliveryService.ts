import { DeliveryStatus, UserRole } from "@prisma/client";
import { customerRepository } from "../repositories/customerRepository";
import {
  DeliveryRepository,
  type DeliveryRecord,
} from "../repositories/deliveryRepository";
import { sellerRepository } from "../repositories/sellerRepository";
import type { AuthenticatedUserDto } from "../types/auth";
import type {
  DeliveryDto,
  DeliveryStatusHistoryDto,
  DeliveryStatusInput,
  DeliveryTrackingInput,
} from "../types/delivery";
import {
  ConflictError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";

function toDto(record: DeliveryRecord): DeliveryDto {
  return {
    id: record.id,
    sellerOrderId: record.sellerOrderId,
    trackingCode: record.trackingCode,
    carrier: record.carrier,
    status: record.status,
    estimatedDelivery: record.estimatedDelivery,
    deliveredAt: record.deliveredAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function normalizeText(
  value: unknown,
  field: string,
  required = false,
): string | null {
  if (value === undefined || value === null) {
    if (required) throw new ValidationError(`${field} is required`);
    return null;
  }
  if (typeof value !== "string")
    throw new ValidationError(`${field} must be a string`);
  const normalized = value.trim();
  if (required && !normalized)
    throw new ValidationError(`${field} is required`);
  if (normalized.length > 255)
    throw new ValidationError(`${field} is too long`);
  return normalized || null;
}

function normalizeReason(value: unknown): string | null {
  return normalizeText(value, "reason");
}

function normalizeTracking(
  input: DeliveryTrackingInput,
  requireField = true,
): DeliveryTrackingInput {
  const result: DeliveryTrackingInput = {};
  if (input.trackingCode !== undefined)
    result.trackingCode = normalizeText(
      input.trackingCode,
      "trackingCode",
      true,
    );
  if (input.carrier !== undefined)
    result.carrier = normalizeText(input.carrier, "carrier", true);
  if (input.estimatedDelivery !== undefined) {
    if (
      input.estimatedDelivery !== null &&
      Number.isNaN(input.estimatedDelivery.getTime())
    )
      throw new ValidationError("estimatedDelivery is invalid");
    result.estimatedDelivery = input.estimatedDelivery;
  }
  if (requireField && !Object.keys(result).length)
    throw new ValidationError("No fields to update");
  return result;
}

export class DeliveryService {
  constructor(private readonly repository = new DeliveryRepository()) {}

  private async readAccess(user: AuthenticatedUserDto) {
    if (user.role === UserRole.ADMIN) return { admin: true };
    if (user.role === UserRole.CUSTOMER) {
      const customer = await customerRepository.findByUserId(user.id);
      if (!customer) throw new ForbiddenError();
      return { customerId: customer.id };
    }
    if (user.role === UserRole.SELLER) {
      const seller = await sellerRepository.findByUserId(user.id);
      if (!seller || !seller.isActive) throw new ForbiddenError();
      return { sellerId: seller.id };
    }
    throw new ForbiddenError();
  }

  private async writeAccess(user: AuthenticatedUserDto) {
    if (user.role === UserRole.ADMIN) return { admin: true };
    if (user.role !== UserRole.SELLER) throw new ForbiddenError();

    const seller = await sellerRepository.findByUserId(user.id);
    if (!seller || !seller.isActive) throw new ForbiddenError();
    return { sellerId: seller.id };
  }

  async createDelivery(
    user: AuthenticatedUserDto,
    sellerOrderId: string,
    input: DeliveryTrackingInput,
  ): Promise<DeliveryDto> {
    const access = await this.writeAccess(user);
    if (!access.admin && !access.sellerId) throw new ForbiddenError();
    return toDto(
      await this.repository.create(
        sellerOrderId,
        access.sellerId ?? null,
        normalizeTracking(input, false),
      ),
    );
  }

  async getBySellerOrder(
    user: AuthenticatedUserDto,
    sellerOrderId: string,
  ): Promise<DeliveryDto> {
    const delivery = await this.repository.findBySellerOrder(
      sellerOrderId,
      await this.readAccess(user),
    );
    if (!delivery) throw new ObjectNotFoundError("Delivery");
    return toDto(delivery);
  }

  async get(user: AuthenticatedUserDto, id: string): Promise<DeliveryDto> {
    const delivery = await this.repository.findById(
      id,
      await this.readAccess(user),
    );
    if (!delivery) throw new ObjectNotFoundError("Delivery");
    return toDto(delivery);
  }

  async history(
    user: AuthenticatedUserDto,
    id: string,
  ): Promise<DeliveryStatusHistoryDto[]> {
    await this.get(user, id);
    return (await this.repository.listHistory(id)).map((record) => ({
      id: record.id,
      deliveryId: record.deliveryId,
      fromStatus: record.fromStatus,
      toStatus: record.toStatus,
      changedAt: record.changedAt,
      reason: record.reason,
    }));
  }

  async transition(
    user: AuthenticatedUserDto,
    id: string,
    input: DeliveryStatusInput,
  ): Promise<DeliveryDto> {
    const access = await this.writeAccess(user);
    const current = await this.repository.findById(id, access);
    if (!current) throw new ObjectNotFoundError("Delivery");
    const updated = await this.repository.transition(
      id,
      { status: input.status, reason: normalizeReason(input.reason) },
      access,
    );
    if (!updated) throw new ObjectNotFoundError("Delivery");
    return toDto(updated);
  }

  async updateTracking(
    user: AuthenticatedUserDto,
    id: string,
    input: DeliveryTrackingInput,
  ): Promise<DeliveryDto> {
    const access = await this.writeAccess(user);
    if (!(await this.repository.findById(id, access)))
      throw new ObjectNotFoundError("Delivery");
    const updated = await this.repository.updateTracking(
      id,
      normalizeTracking(input),
      access,
    );
    if (!updated) throw new ObjectNotFoundError("Delivery");
    return toDto(updated);
  }

  async advanceForJob(
    id: string,
    expectedStatus: DeliveryStatus,
    eligibleBefore: Date,
    expectedHistoryId?: string,
  ): Promise<DeliveryDto | null> {
    const delivery = await this.repository.findById(id, { admin: true });
    if (!delivery || delivery.status !== expectedStatus) return null;
    const next: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
      SEPARATED: "PROCESSING",
      PROCESSING: "SHIPPED",
      SHIPPED: "COLLECTED",
      COLLECTED: "ARRIVED_AT_CENTER",
      ARRIVED_AT_CENTER: "DELIVERED",
    };
    const nextStatus = next[delivery.status];
    if (!nextStatus) return toDto(delivery);
    const updated = await this.repository.transition(
      id,
      { status: nextStatus, reason: "Scheduled delivery progression" },
      { admin: true },
      expectedStatus,
      eligibleBefore,
      expectedHistoryId,
    );
    return updated ? toDto(updated) : null;
  }
}
