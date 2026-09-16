import { createHash } from "crypto";
import { UserRole } from "@prisma/client";
import { checkoutRepository, CheckoutConflictError, CheckoutNotFoundError, CheckoutRepository } from "../repositories/checkoutRepository";
import type { CheckoutReadRecord } from "../repositories/checkoutRepository";
import { customerRepository } from "../repositories/customerRepository";
import { userRepository } from "../repositories/userRepository";
import { ConflictError, ForbiddenError, ObjectNotFoundError, ValidationError } from "../utils/customErrors";
import type { CheckoutDto } from "../types/checkout";

export function toCheckoutDto(record: CheckoutReadRecord): CheckoutDto {
  return {
    id: record.id, status: record.status, subtotalInCents: record.subtotalInCents,
    shippingInCents: record.shippingInCents, taxInCents: record.taxInCents,
    discountInCents: record.discountInCents, totalInCents: record.totalInCents,
    currency: record.currency, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
    address: record.address ? {
      id: record.address.id, sourceAddressId: record.address.sourceAddressId,
      recipientName: record.address.recipientName, postalCode: record.address.postalCode,
      street: record.address.street, number: record.address.number, complement: record.address.complement,
      neighborhood: record.address.neighborhood, city: record.address.city, state: record.address.state,
      countryCode: record.address.countryCode, phone: record.address.phone, createdAt: record.address.createdAt.toISOString(),
    } : null,
    sellerOrders: record.sellerOrders.map((sellerOrder) => ({
      id: sellerOrder.id, sellerId: sellerOrder.sellerId, status: sellerOrder.status,
      subtotalInCents: sellerOrder.subtotalInCents, shippingInCents: sellerOrder.shippingInCents,
      taxInCents: sellerOrder.taxInCents, discountInCents: sellerOrder.discountInCents,
      totalInCents: sellerOrder.totalInCents, currency: sellerOrder.currency,
      items: sellerOrder.items.map((item) => ({
        id: item.id, productId: item.productId, quantity: item.quantity,
        unitPriceInCents: item.unitPriceInCents, lineTotalInCents: item.lineTotalInCents,
        currency: item.currency, productNameSnapshot: item.productNameSnapshot,
        productReferenceSnapshot: item.productReferenceSnapshot, sellerNameSnapshot: item.sellerNameSnapshot,
        reservation: item.inventoryReservation ? {
          id: item.inventoryReservation.id, status: item.inventoryReservation.status,
          quantity: item.inventoryReservation.quantity, expiresAt: item.inventoryReservation.expiresAt?.toISOString() ?? null,
        } : null,
      })),
    })),
  };
}

export class CheckoutService {
  constructor(private readonly repository: CheckoutRepository = checkoutRepository) {}
  async checkout(userId: string, input: Record<string, unknown>, idempotencyKey: string) {
    const key = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
    if (!key || key.length > 255) throw new ValidationError("Idempotency-Key must be a non-empty string of at most 255 characters");
    const keys = Object.keys(input);
    if (keys.length !== 1 || keys[0] !== "addressId") throw new ValidationError("Only addressId is accepted");
    if (typeof input.addressId !== "string" || input.addressId.trim() === "") throw new ValidationError("addressId is required");
    const user = await userRepository.findById(userId);
    if (!user || !user.isActive) throw new ObjectNotFoundError("Customer");
    if (user.role !== UserRole.CUSTOMER) throw new ForbiddenError();
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new ObjectNotFoundError("CustomerProfile");
    try {
      const requestFingerprint = createHash("sha256").update(JSON.stringify({ addressId: input.addressId.trim() })).digest("hex");
      const execution = await this.repository.createIdempotentCheckout({
        userId, customerId: customer.id, addressId: input.addressId.trim(), operation: "CHECKOUT_V1", key,
        requestFingerprint, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), serialize: toCheckoutDto,
      });
      return { result: execution.result, replayed: execution.replayed };
    } catch (error) {
      if (error instanceof CheckoutNotFoundError) throw new ObjectNotFoundError(error.message.replace(" not found", ""));
      if (error instanceof CheckoutConflictError) throw new ConflictError(error.message);
      throw error;
    }
  }
}

export const checkoutService = new CheckoutService();
