import { OrderStatus, SellerOrderStatus } from "@prisma/client";
import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { OrderService } from "../services/orderService";
import type { OrderReadFilters, SellerOrderReadFilters } from "../types/order";
import {
  ConflictError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";

export const orderRoutes = Router();
const service = new OrderService();

function pagination(req: { query: Record<string, unknown> }) {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new ValidationError("Invalid pagination");
  return { page, limit };
}
function filters(
  query: Record<string, unknown>,
  seller = false,
): OrderReadFilters | SellerOrderReadFilters {
  const result: OrderReadFilters = {};
  const status = query.status;
  const allowed = seller
    ? Object.values(SellerOrderStatus)
    : Object.values(OrderStatus);
  if (status !== undefined) {
    if (typeof status !== "string" || !allowed.includes(status as never))
      throw new ValidationError("Invalid status");
    result.status = status as OrderStatus;
  }
  for (const key of ["createdFrom", "createdTo"] as const) {
    const value = query[key];
    if (value !== undefined) {
      if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
        throw new ValidationError(`Invalid ${key}`);
      result[key] = new Date(value);
    }
  }
  if (
    result.createdFrom &&
    result.createdTo &&
    result.createdFrom > result.createdTo
  )
    throw new ValidationError("Invalid date range");
  return result;
}
function handle(
  error: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  if (error instanceof ValidationError)
    return res.status(400).json({ error: error.message });
  if (error instanceof ForbiddenError)
    return res.status(403).json({ error: error.message });
  if (error instanceof ObjectNotFoundError)
    return res.status(404).json({ error: error.message });
  if (error instanceof ConflictError)
    return res.status(409).json({ error: error.message });
  return res.status(500).json({ error: "Internal Server Error" });
}

orderRoutes.get("/", authMiddleware, async (req, res) => {
  try {
    const p = pagination(req);
    res
      .status(200)
      .json(
        await service.listCustomerOrders(
          req.user.id,
          filters(req.query) as OrderReadFilters,
          p.page,
          p.limit,
        ),
      );
  } catch (e) {
    handle(e, res);
  }
});
orderRoutes.get("/:orderId", authMiddleware, async (req, res) => {
  try {
    res
      .status(200)
      .json(await service.getCustomerOrder(req.user.id, req.params.orderId));
  } catch (e) {
    handle(e, res);
  }
});
export const sellerOrderRoutes = Router();
sellerOrderRoutes.get("/", authMiddleware, async (req, res) => {
  try {
    const p = pagination(req);
    res
      .status(200)
      .json(
        await service.listSellerOrders(
          req.user.id,
          filters(req.query, true) as SellerOrderReadFilters,
          p.page,
          p.limit,
        ),
      );
  } catch (e) {
    handle(e, res);
  }
});
sellerOrderRoutes.get("/:sellerOrderId", authMiddleware, async (req, res) => {
  try {
    res
      .status(200)
      .json(
        await service.getSellerOrder(req.user.id, req.params.sellerOrderId),
      );
  } catch (e) {
    handle(e, res);
  }
});
sellerOrderRoutes.patch(
  "/:sellerOrderId/status",
  authMiddleware,
  async (req, res) => {
    try {
      if (
        !req.body ||
        typeof req.body.status !== "string" ||
        Object.keys(req.body).some(
          (key) => !["status", "reason"].includes(key),
        ) ||
        (req.body.reason !== undefined && typeof req.body.reason !== "string")
      )
        throw new ValidationError("Invalid transition payload");
      res
        .status(200)
        .json(
          await service.transitionSellerOrder(
            req.user,
            req.params.sellerOrderId,
            { status: req.body.status, reason: req.body.reason },
          ),
        );
    } catch (e) {
      handle(e, res);
    }
  },
);
