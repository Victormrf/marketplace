import { SellerOrderStatus } from "@prisma/client";
import { Router, Response } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { DashboardService } from "../services/dashboardService";
import type { DashboardRangeInput } from "../types/dashboard";
import {
  ForbiddenError,
  ValidationError,
} from "../utils/customErrors";

const dashboardService = new DashboardService();
export const dashboardRoutes = Router();

function dateOnly(value: unknown, field: string): Date | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`Invalid ${field}`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ValidationError(`Invalid ${field}`);
  }
  return date;
}

function range(query: Record<string, unknown>): DashboardRangeInput {
  const from = dateOnly(query.from, "from");
  const to = dateOnly(query.to, "to");
  if (from && to && from > to) {
    throw new ValidationError("Invalid date range");
  }
  return { from, to };
}

function pagination(query: Record<string, unknown>) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new ValidationError("Invalid pagination");
  }
  return { page, limit };
}

function status(query: Record<string, unknown>): SellerOrderStatus | undefined {
  if (query.status === undefined) return undefined;
  if (
    typeof query.status !== "string" ||
    !Object.values(SellerOrderStatus).includes(
      query.status as SellerOrderStatus,
    )
  ) {
    throw new ValidationError("Invalid status");
  }
  return query.status as SellerOrderStatus;
}

function topLimit(query: Record<string, unknown>): number {
  const value = query.limit === undefined ? 5 : Number(query.limit);
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) {
    throw new ValidationError("Invalid limit");
  }
  return value;
}

function interval(query: Record<string, unknown>): "day" | "month" {
  const value = query.interval ?? "day";
  if (value !== "day" && value !== "month") {
    throw new ValidationError("Invalid interval");
  }
  return value;
}

function handleError(error: unknown, res: Response): void {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof ForbiddenError) {
    res.status(403).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: "Internal Server Error" });
}

dashboardRoutes.get(
  "/seller/summary",
  authMiddleware,
  async (req, res) => {
    try {
      res.status(200).json(await dashboardService.getSummary(req.user, range(req.query)));
    } catch (error) {
      handleError(error, res);
    }
  },
);

dashboardRoutes.get(
  "/seller/orders",
  authMiddleware,
  async (req, res) => {
    try {
      res.status(200).json(
        await dashboardService.getOrders(
          req.user,
          range(req.query),
          pagination(req.query),
          status(req.query),
        ),
      );
    } catch (error) {
      handleError(error, res);
    }
  },
);

dashboardRoutes.get(
  "/seller/orders/by-status",
  authMiddleware,
  async (req, res) => {
    try {
      res.status(200).json(
        await dashboardService.getOrdersByStatus(req.user, range(req.query)),
      );
    } catch (error) {
      handleError(error, res);
    }
  },
);

dashboardRoutes.get(
  "/seller/sales/timeseries",
  authMiddleware,
  async (req, res) => {
    try {
      res.status(200).json(
        await dashboardService.getTimeseries(
          req.user,
          range(req.query),
          interval(req.query),
        ),
      );
    } catch (error) {
      handleError(error, res);
    }
  },
);

dashboardRoutes.get(
  "/seller/sales/by-category",
  authMiddleware,
  async (req, res) => {
    try {
      res.status(200).json(
        await dashboardService.getByCategory(req.user, range(req.query)),
      );
    } catch (error) {
      handleError(error, res);
    }
  },
);

dashboardRoutes.get(
  "/seller/products/top",
  authMiddleware,
  async (req, res) => {
    try {
      res.status(200).json(
        await dashboardService.getTopProducts(
          req.user,
          range(req.query),
          topLimit(req.query),
        ),
      );
    } catch (error) {
      handleError(error, res);
    }
  },
);

dashboardRoutes.get(
  "/seller/customers/new",
  authMiddleware,
  async (req, res) => {
    try {
      res.status(200).json(
        await dashboardService.getNewCustomers(req.user, range(req.query)),
      );
    } catch (error) {
      handleError(error, res);
    }
  },
);

dashboardRoutes.get(
  "/seller/ratings",
  authMiddleware,
  async (req, res) => {
    try {
      res.status(200).json(await dashboardService.getRatings(req.user));
    } catch (error) {
      handleError(error, res);
    }
  },
);
