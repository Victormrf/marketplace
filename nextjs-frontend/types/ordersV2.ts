export type OrderStatusV2 =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "PARTIALLY_COMPLETED"
  | "COMPLETED"
  | "CANCELLED";

export type SellerOrderStatusV2 =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type OrderItemV2 = {
  id: string;
  productId: string;
  quantity: number;
  unitPriceInCents: number;
  lineTotalInCents: number;
  currency: string;
  productNameSnapshot: string;
  productReferenceSnapshot: string | null;
  sellerNameSnapshot: string;
};

export type OrderHistoryV2 = {
  id: string;
  fromStatus: OrderStatusV2 | null;
  toStatus: OrderStatusV2;
  reason: string | null;
  createdAt: string;
};

export type SellerOrderHistoryV2 = {
  id: string;
  fromStatus: SellerOrderStatusV2 | null;
  toStatus: SellerOrderStatusV2;
  reason: string | null;
  createdAt: string;
};

export type OrderAddressV2 = {
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

export type SellerOrderSummaryV2 = {
  id: string;
  orderId: string;
  sellerId: string;
  status: SellerOrderStatusV2;
  totalInCents: number;
  currency: string;
  createdAt: string;
};

export type SellerOrderDetailV2 = SellerOrderSummaryV2 & {
  subtotalInCents: number;
  shippingInCents: number;
  taxInCents: number;
  discountInCents: number;
  updatedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  items: OrderItemV2[];
  statusHistory: SellerOrderHistoryV2[];
};

export type OrderSummaryV2 = {
  id: string;
  status: OrderStatusV2;
  totalInCents: number;
  currency: string;
  createdAt: string;
};

export type OrderDetailV2 = OrderSummaryV2 & {
  customerId: string;
  subtotalInCents: number;
  shippingInCents: number;
  taxInCents: number;
  discountInCents: number;
  updatedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  address: OrderAddressV2 | null;
  sellerOrders: SellerOrderDetailV2[];
  statusHistory: OrderHistoryV2[];
};

export type Paged<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type OrderListFilters = {
  page?: number;
  limit?: number;
  status?: OrderStatusV2;
  createdFrom?: string;
  createdTo?: string;
};

export type SellerOrderListFilters = Omit<OrderListFilters, "status"> & {
  status?: SellerOrderStatusV2;
};
