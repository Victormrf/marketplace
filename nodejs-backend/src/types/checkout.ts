export type CheckoutReservationDto = { id: string; status: string; quantity: number; expiresAt: string | null };
export type CheckoutOrderItemDto = {
  id: string; productId: string; quantity: number; unitPriceInCents: number; lineTotalInCents: number; currency: string;
  productNameSnapshot: string; productReferenceSnapshot: string | null; sellerNameSnapshot: string; reservation: CheckoutReservationDto | null;
};
export type CheckoutSellerOrderDto = {
  id: string; sellerId: string; status: string; subtotalInCents: number; shippingInCents: number; taxInCents: number;
  discountInCents: number; totalInCents: number; currency: string; items: CheckoutOrderItemDto[];
};
export type CheckoutAddressDto = {
  id: string; sourceAddressId: string | null; recipientName: string; postalCode: string; street: string; number: string;
  complement: string | null; neighborhood: string; city: string; state: string; countryCode: string; phone: string | null; createdAt: string;
};
export type CheckoutDto = {
  id: string; status: string; subtotalInCents: number; shippingInCents: number; taxInCents: number; discountInCents: number;
  totalInCents: number; currency: string; createdAt: string; updatedAt: string; address: CheckoutAddressDto | null; sellerOrders: CheckoutSellerOrderDto[];
};
