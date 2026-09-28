import { browserRequest } from "@/lib/http";
import type {
  OrderDetailV2,
  OrderListFilters,
  OrderSummaryV2,
  Paged,
  SellerOrderDetailV2,
  SellerOrderListFilters,
  SellerOrderStatusV2,
  SellerOrderSummaryV2,
} from "@/types/ordersV2";

function queryString(filters: OrderListFilters | SellerOrderListFilters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.toString();
}

export function listMyOrders(filters: OrderListFilters) {
  const query = queryString(filters);
  return browserRequest<Paged<OrderSummaryV2>>(
    `/api/orders${query ? `?${query}` : ""}`,
  );
}

export function getMyOrder(orderId: string) {
  return browserRequest<OrderDetailV2>(`/api/orders/${encodeURIComponent(orderId)}`);
}

export function listMySellerOrders(filters: SellerOrderListFilters) {
  const query = queryString(filters);
  return browserRequest<Paged<SellerOrderSummaryV2>>(
    `/api/seller-orders${query ? `?${query}` : ""}`,
  );
}

export function getMySellerOrder(sellerOrderId: string) {
  return browserRequest<SellerOrderDetailV2>(
    `/api/seller-orders/${encodeURIComponent(sellerOrderId)}`,
  );
}

export function transitionMySellerOrder(
  sellerOrderId: string,
  status: Extract<SellerOrderStatusV2, "CONFIRMED" | "PROCESSING">,
  reason?: string,
) {
  return browserRequest<SellerOrderDetailV2>(
    `/api/seller-orders/${encodeURIComponent(sellerOrderId)}/status`,
    { method: "PATCH", json: { status, ...(reason ? { reason } : {}) } },
  );
}
