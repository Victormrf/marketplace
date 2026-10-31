export type CheckoutReservationDto = {
  id: string;
  status: string;
  quantity: number;
  expiresAt: string | null;
};
export type CheckoutOrderItemDto = {
  id: string;
  productId: string;
  quantity: number;
  unitPriceInCents: number;
  lineTotalInCents: number;
  currency: string;
  productNameSnapshot: string;
  productReferenceSnapshot: string | null;
  sellerNameSnapshot: string;
  reservation: CheckoutReservationDto | null;
};
export type CheckoutSellerOrderDto = {
  id: string;
  sellerId: string;
  status: string;
  subtotalInCents: number;
  shippingInCents: number;
  taxInCents: number;
  discountInCents: number;
  totalInCents: number;
  currency: string;
  items: CheckoutOrderItemDto[];
};
export type CheckoutAddressDto = {
  id: string;
  sourceAddressId: string | null;
  recipientName: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  countryCode: string;
  phone: string | null;
  createdAt: string;
};
export type CheckoutDto = {
  id: string;
  status: string;
  subtotalInCents: number;
  shippingInCents: number;
  taxInCents: number;
  discountInCents: number;
  totalInCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  address: CheckoutAddressDto | null;
  sellerOrders: CheckoutSellerOrderDto[];
};
// Internal diagnostic categories; not fields of the public checkout DTO.
export const CHECKOUT_CONFLICT_CODES = [
  "BUSINESS_CONFLICT",
  "CART_EMPTY",
  "INSUFFICIENT_STOCK",
  "PRODUCT_UNAVAILABLE",
  "INVALID_QUANTITY",
  "IDEMPOTENCY_PROCESSING",
  "IDEMPOTENCY_FINGERPRINT_MISMATCH",
  "IDEMPOTENCY_STATE_CONFLICT",
  "PRODUCT_NOT_FOUND",
  "SELLER_NOT_FOUND",
  "INVENTORY_UNAVAILABLE",
  "UNSUPPORTED_CURRENCY",
] as const;

export type CheckoutConflictCode = (typeof CHECKOUT_CONFLICT_CODES)[number];
export type CheckoutFailureCode =
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_TIMEOUT"
  | "UNEXPECTED_CHECKOUT_ERROR";
