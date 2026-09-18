import type { SellerOrderStatus } from "@prisma/client";

export type DashboardDateRange = {
  from: Date;
  toExclusive: Date;
};

export type DashboardRangeInput = {
  from?: Date;
  to?: Date;
};

export type DashboardPagination = {
  page: number;
  limit: number;
};

export type SellerDashboardSummaryDto = {
  currency: "BRL";
  grossRevenueInCents: number;
  deliveredSellerOrders: number;
  itemsSold: number;
  averageTicketInCents: number;
};

export type SellerDashboardOrderDto = {
  id: string;
  status: SellerOrderStatus;
  totalInCents: number;
  currency: "BRL";
  createdAt: Date;
  completedAt: Date | null;
};

export type SellerDashboardOrderCollectionDto = {
  data: SellerDashboardOrderDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type DashboardStatusCountDto = {
  status: SellerOrderStatus;
  count: number;
};

export type DashboardTimeseriesDto = {
  period: string;
  grossRevenueInCents: number;
  sellerOrders: number;
};

export type DashboardCategoryDto = {
  category: string;
  grossRevenueInCents: number;
  itemsSold: number;
};

export type DashboardTopProductDto = {
  productId: string;
  productName: string;
  itemsSold: number;
  grossRevenueInCents: number;
};

export type DashboardNewCustomersDto = {
  period: string;
  newCustomers: number;
};

export type DashboardRatingsDto = {
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
