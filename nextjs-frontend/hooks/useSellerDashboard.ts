"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/http";
import {
  getSellerDashboardCategories,
  getSellerDashboardNewCustomers,
  getSellerDashboardOrders,
  getSellerDashboardOrdersByStatus,
  getSellerDashboardRatings,
  getSellerDashboardSummary,
  getSellerDashboardTimeseries,
  getSellerDashboardTopProducts,
} from "@/services/dashboard";
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

type DashboardData = {
  summary: SellerDashboardSummary;
  orders: SellerDashboardOrderCollection;
  statuses: DashboardStatusCount[];
  timeseries: DashboardTimeseriesPoint[];
  categories: DashboardCategory[];
  topProducts: DashboardTopProduct[];
  newCustomers: DashboardNewCustomersPoint[];
  ratings: DashboardRatings;
};

const emptyData: DashboardData = {
  summary: {
    currency: "BRL",
    grossRevenueInCents: 0,
    deliveredSellerOrders: 0,
    itemsSold: 0,
    averageTicketInCents: 0,
  },
  orders: {
    data: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  },
  statuses: [],
  timeseries: [],
  categories: [],
  topProducts: [],
  newCustomers: [],
  ratings: {
    averageRating: null,
    totalReviews: 0,
    distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
  },
};

type RequestFailure = {
  message: string;
  status: number | null;
};

const analyticsErrorMessage =
  "Não foi possível carregar o dashboard. Verifique sua conexão e tente novamente.";

// Each dependency group owns its request generation, error and loading state.
function useDashboardQuery<T>(
  query: () => Promise<T>,
  initialData: T,
  enabled: boolean,
  errorMessage: string,
) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<RequestFailure | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }

    const requestGeneration = ++generation.current;
    setLoading(true);
    setError(null);

    try {
      const result = await query();
      if (requestGeneration === generation.current) {
        setData(result);
      }
    } catch (requestError) {
      if (requestGeneration === generation.current) {
        setError({
          message:
            requestError instanceof ApiError
              ? requestError.message
              : errorMessage,
          status: requestError instanceof ApiError ? requestError.status : null,
        });
      }
    } finally {
      if (requestGeneration === generation.current) {
        setLoading(false);
      }
    }
  }, [enabled, query, errorMessage]);

  useEffect(() => {
    if (enabled) {
      void refresh();
    } else {
      setLoading(false);
    }

    // Invalidate pending requests on filter changes, disable and unmount.
    return () => {
      generation.current += 1;
    };
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
}

export function useSellerDashboard(range: DashboardRange, enabled: boolean) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SellerOrderStatus | "">("");
  const [interval, setInterval] = useState<"day" | "month">("day");
  const { from, to } = range;

  const loadAnalytics = useCallback(async () => {
    const range = { from, to };
    const [summary, statuses, categories, topProducts, newCustomers] =
      await Promise.all([
        getSellerDashboardSummary(range),
        getSellerDashboardOrdersByStatus(range),
        getSellerDashboardCategories(range),
        getSellerDashboardTopProducts(range),
        getSellerDashboardNewCustomers(range),
      ]);

    return { summary, statuses, categories, topProducts, newCustomers };
  }, [from, to]);
  const loadTimeseries = useCallback(
    () => getSellerDashboardTimeseries({ from, to }, interval),
    [from, to, interval],
  );
  const loadOrders = useCallback(
    () => getSellerDashboardOrders({ from, to }, page, 10, status || undefined),
    [from, to, page, status],
  );

  const analytics = useDashboardQuery(
    loadAnalytics,
    {
      summary: emptyData.summary,
      statuses: emptyData.statuses,
      categories: emptyData.categories,
      topProducts: emptyData.topProducts,
      newCustomers: emptyData.newCustomers,
    },
    enabled,
    analyticsErrorMessage,
  );
  const timeseries = useDashboardQuery(
    loadTimeseries,
    emptyData.timeseries,
    enabled,
    analyticsErrorMessage,
  );
  const ratings = useDashboardQuery(
    getSellerDashboardRatings,
    emptyData.ratings,
    enabled,
    analyticsErrorMessage,
  );
  const orders = useDashboardQuery(
    loadOrders,
    emptyData.orders,
    enabled,
    "Não foi possível carregar as SellerOrders. Verifique sua conexão e tente novamente.",
  );

  const refreshAnalytics = analytics.refresh;
  const refreshTimeseries = timeseries.refresh;
  const refreshRatings = ratings.refresh;
  const refreshOrders = orders.refresh;
  const refresh = useCallback(async () => {
    await Promise.all([
      refreshAnalytics(),
      refreshTimeseries(),
      refreshRatings(),
      refreshOrders(),
    ]);
  }, [refreshAnalytics, refreshTimeseries, refreshRatings, refreshOrders]);
  const error =
    analytics.error ?? timeseries.error ?? ratings.error ?? orders.error;

  return {
    data: {
      ...analytics.data,
      timeseries: timeseries.data,
      ratings: ratings.data,
      orders: orders.data,
    },
    loading:
      analytics.loading ||
      timeseries.loading ||
      ratings.loading ||
      orders.loading,
    error: error?.message ?? null,
    errorStatus: error?.status ?? null,
    page,
    setPage,
    status,
    setStatus,
    interval,
    setInterval,
    refresh,
  };
}
