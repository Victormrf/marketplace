import { browserRequest } from "@/lib/http";
import type {
  DashboardCategory,
  DashboardNewCustomersPoint,
  DashboardRange,
  DashboardRatings,
  DashboardStatusCount,
  DashboardTimeseriesPoint,
  DashboardTopProduct,
  SellerDashboardOrderCollection,
  SellerDashboardSummary,
  SellerOrderStatus,
} from "@/types/dashboard";

function rangeQuery(range: DashboardRange): string {
  const query = new URLSearchParams({ from: range.from, to: range.to });
  return query.toString();
}

export function getSellerDashboardSummary(
  range: DashboardRange,
): Promise<SellerDashboardSummary> {
  return browserRequest(`/api/dashboard/seller/summary?${rangeQuery(range)}`);
}

export function getSellerDashboardOrders(
  range: DashboardRange,
  page: number,
  limit: number,
  status?: SellerOrderStatus,
): Promise<SellerDashboardOrderCollection> {
  const query = new URLSearchParams({
    from: range.from,
    to: range.to,
    page: String(page),
    limit: String(limit),
  });
  if (status) query.set("status", status);
  return browserRequest(`/api/dashboard/seller/orders?${query.toString()}`);
}

export function getSellerDashboardOrdersByStatus(
  range: DashboardRange,
): Promise<DashboardStatusCount[]> {
  return browserRequest(
    `/api/dashboard/seller/orders/by-status?${rangeQuery(range)}`,
  );
}

export function getSellerDashboardTimeseries(
  range: DashboardRange,
  interval: "day" | "month",
): Promise<DashboardTimeseriesPoint[]> {
  const query = new URLSearchParams({
    from: range.from,
    to: range.to,
    interval,
  });
  return browserRequest(
    `/api/dashboard/seller/sales/timeseries?${query.toString()}`,
  );
}

export function getSellerDashboardCategories(
  range: DashboardRange,
): Promise<DashboardCategory[]> {
  return browserRequest(
    `/api/dashboard/seller/sales/by-category?${rangeQuery(range)}`,
  );
}

export function getSellerDashboardTopProducts(
  range: DashboardRange,
  limit = 5,
): Promise<DashboardTopProduct[]> {
  const query = new URLSearchParams({
    from: range.from,
    to: range.to,
    limit: String(limit),
  });
  return browserRequest(
    `/api/dashboard/seller/products/top?${query.toString()}`,
  );
}

export function getSellerDashboardNewCustomers(
  range: DashboardRange,
): Promise<DashboardNewCustomersPoint[]> {
  return browserRequest(
    `/api/dashboard/seller/customers/new?${rangeQuery(range)}`,
  );
}

export function getSellerDashboardRatings(): Promise<DashboardRatings> {
  return browserRequest("/api/dashboard/seller/ratings");
}
