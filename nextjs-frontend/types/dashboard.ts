export type SellerOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type DashboardRange = {
  from: string;
  to: string;
};

export type DashboardPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type SellerDashboardSummary = {
  currency: "BRL";
  grossRevenueInCents: number;
  deliveredSellerOrders: number;
  itemsSold: number;
  averageTicketInCents: number;
};

export type SellerDashboardOrder = {
  id: string;
  status: SellerOrderStatus;
  totalInCents: number;
  currency: "BRL";
  createdAt: string;
  completedAt: string | null;
};

export type SellerDashboardOrderCollection = {
  data: SellerDashboardOrder[];
  pagination: DashboardPagination;
};

export type DashboardStatusCount = {
  status: SellerOrderStatus;
  count: number;
};

export type DashboardTimeseriesPoint = {
  period: string;
  grossRevenueInCents: number;
  sellerOrders: number;
};

export type DashboardCategory = {
  category: string;
  grossRevenueInCents: number;
  itemsSold: number;
};

export type DashboardTopProduct = {
  productId: string;
  productName: string;
  itemsSold: number;
  grossRevenueInCents: number;
};

export type DashboardNewCustomersPoint = {
  period: string;
  newCustomers: number;
};

export type DashboardRatings = {
  averageRating: number | null;
  totalReviews: number;
  distribution: {
    "1": number;
    "2": number;
    "3": number;
    "4": number;
    "5": number;
  };
};
