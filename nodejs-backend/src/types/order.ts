import type { Currency, OrderStatus, SellerOrderStatus } from "@prisma/client";

export type OrderReadFilters = {
  status?: OrderStatus;
  createdFrom?: Date;
  createdTo?: Date;
};

export type SellerOrderReadFilters = {
  status?: SellerOrderStatus;
  createdFrom?: Date;
  createdTo?: Date;
};

export type OrderPaginationDto = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type OrderItemDto = {
  id: string;
  productId: string;
  quantity: number;
  unitPriceInCents: number;
  lineTotalInCents: number;
  currency: Currency;
  productNameSnapshot: string;
  productReferenceSnapshot: string | null;
  sellerNameSnapshot: string;
};

export type OrderAddressDto = {
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
  createdAt: Date;
};

export type OrderStatusHistoryDto = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string | null;
  createdAt: Date;
};

export type SellerOrderStatusHistoryDto = {
  id: string;
  fromStatus: SellerOrderStatus | null;
  toStatus: SellerOrderStatus;
  reason: string | null;
  createdAt: Date;
};

export type SellerOrderSummaryDto = {
  id: string;
  orderId: string;
  sellerId: string;
  status: SellerOrderStatus;
  totalInCents: number;
  currency: Currency;
  createdAt: Date;
};

export type SellerOrderDetailDto = SellerOrderSummaryDto & {
  subtotalInCents: number;
  shippingInCents: number;
  taxInCents: number;
  discountInCents: number;
  updatedAt: Date;
  confirmedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  items: OrderItemDto[];
  statusHistory: SellerOrderStatusHistoryDto[];
};

export type OrderSummaryDto = {
  id: string;
  status: OrderStatus;
  totalInCents: number;
  currency: Currency;
  createdAt: Date;
};

export type OrderDetailDto = OrderSummaryDto & {
  customerId: string;
  subtotalInCents: number;
  shippingInCents: number;
  taxInCents: number;
  discountInCents: number;
  updatedAt: Date;
  confirmedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  address: OrderAddressDto | null;
  sellerOrders: SellerOrderDetailDto[];
  statusHistory: OrderStatusHistoryDto[];
};

export type OrderCollectionDto = {
  data: OrderSummaryDto[];
  pagination: OrderPaginationDto;
};

export type SellerOrderCollectionDto = {
  data: SellerOrderSummaryDto[];
  pagination: OrderPaginationDto;
};

export type OrderTransitionInput = {
  status: string;
  reason?: string;
};
