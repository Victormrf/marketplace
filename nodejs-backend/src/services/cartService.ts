import { UserRole } from "@prisma/client";
import { cartRepository, CartMutationConflictError } from "../repositories/cartRepository";
import type { CartReadRecord } from "../repositories/cartRepository";
import { customerRepository } from "../repositories/customerRepository";
import { userRepository } from "../repositories/userRepository";
import { ConflictError, ForbiddenError, ObjectNotFoundError, ValidationError } from "../utils/customErrors";
import type { CartDto } from "../types/cart";

function exactFields(input: Record<string, unknown>, allowed: string[]) {
  const unknown = Object.keys(input).find((key) => !allowed.includes(key));
  if (unknown) throw new ValidationError(`Unsupported cart field: ${unknown}`);
}

function positiveQuantity(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError("quantity must be a positive integer");
  }
  return value;
}

function productId(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") throw new ValidationError("productId is required");
  return value.trim();
}

function toDto(cart: CartReadRecord): CartDto {
  const items = cart.items.map((item) => {
    const onHand = item.product.inventory?.onHandQuantity ?? 0;
    const reserved = item.product.inventory?.reservedQuantity ?? 0;
    const available = onHand - reserved;
    const hasSufficientStock = item.product.inventory !== null && available >= item.quantity;
    return {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      name: item.product.name,
      priceInCents: item.product.priceInCents,
      currency: item.product.currency as "BRL",
      image: item.product.image,
      availableQuantity: available,
      hasSufficientStock,
      isAvailable: item.product.isActive && item.product.seller.isActive && hasSufficientStock,
      lineTotalInCents: item.quantity * item.product.priceInCents,
    };
  });
  return { id: cart.id, status: "ACTIVE", items, totalInCents: items.reduce((total, item) => total + item.lineTotalInCents, 0) };
}

export class CartService {
  private async customerIdFor(userId: string): Promise<string> {
    const user = await userRepository.findById(userId);
    if (!user || !user.isActive) throw new ObjectNotFoundError("Customer");
    if (user.role !== UserRole.CUSTOMER) throw new ForbiddenError();
    const customer = await customerRepository.findByUserId(userId);
    if (!customer) throw new ObjectNotFoundError("CustomerProfile");
    return customer.id;
  }

  async getCart(userId: string): Promise<CartDto> {
    const customerId = await this.customerIdFor(userId);
    await cartRepository.findOrCreateActive(customerId);
    const cart = await cartRepository.findActiveCart(customerId);
    if (!cart) throw new ObjectNotFoundError("Cart");
    return toDto(cart);
  }

  async addItem(userId: string, input: Record<string, unknown>): Promise<CartDto> {
    exactFields(input, ["productId", "quantity"]);
    const customerId = await this.customerIdFor(userId);
    try {
      await cartRepository.addItem(customerId, productId(input.productId), positiveQuantity(input.quantity));
    } catch (error) {
      if (error instanceof CartMutationConflictError) throw new ConflictError("Product is unavailable or stock is insufficient");
      throw error;
    }
    return this.getCart(userId);
  }

  async updateItem(userId: string, rawProductId: string, input: Record<string, unknown>): Promise<CartDto> {
    exactFields(input, ["quantity"]);
    const customerId = await this.customerIdFor(userId);
    const updated = await cartRepository.updateItem(customerId, productId(rawProductId), positiveQuantity(input.quantity));
    if (!updated) throw new ConflictError("Cart item is unavailable or stock is insufficient");
    return this.getCart(userId);
  }

  async removeItem(userId: string, rawProductId: string): Promise<void> {
    const customerId = await this.customerIdFor(userId);
    const removed = await cartRepository.removeItem(customerId, productId(rawProductId));
    if (!removed) throw new ObjectNotFoundError("CartItem");
  }

  async clear(userId: string): Promise<void> {
    await this.customerIdFor(userId).then((customerId) => cartRepository.clear(customerId));
  }
}

export const cartService = new CartService();
