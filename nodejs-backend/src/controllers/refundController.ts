import { RefundStatus } from "@prisma/client";
import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { RefundService } from "../services/refundService";
import type { RefundReadFilters } from "../types/refund";
import {
  ConflictError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";

export const refundRoutes = Router();
const service = new RefundService();
function pagination(q: Record<string, unknown>) {
  const page = q.page === undefined ? 1 : Number(q.page);
  const limit = q.limit === undefined ? 20 : Number(q.limit);
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
function filters(q: Record<string, unknown>): RefundReadFilters {
  const result: RefundReadFilters = {};
  if (q.status !== undefined) {
    if (
      typeof q.status !== "string" ||
      !Object.values(RefundStatus).includes(q.status as RefundStatus)
    )
      throw new ValidationError("Invalid status");
    result.status = q.status as RefundStatus;
  }
  for (const key of ["createdFrom", "createdTo"] as const)
    if (q[key] !== undefined) {
      if (typeof q[key] !== "string" || Number.isNaN(Date.parse(q[key])))
        throw new ValidationError(`Invalid ${key}`);
      result[key] = new Date(q[key]);
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
refundRoutes.post(
  "/payment-attempts/:paymentAttemptId/refunds",
  authMiddleware,
  async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const keys = Object.keys(body);
      if (
        keys.some((key) => key !== "amountInCents" && key !== "reason") ||
        !Object.prototype.hasOwnProperty.call(body, "amountInCents")
      )
        throw new ValidationError("Only amountInCents and reason are accepted");
      if (typeof body.amountInCents !== "number")
        throw new ValidationError("amountInCents must be a number");
      res
        .status(201)
        .json(
          await service.requestRefund(req.user, req.params.paymentAttemptId, {
            amountInCents: body.amountInCents,
            reason: body.reason as string | null | undefined,
          }),
        );
    } catch (error) {
      handle(error, res);
    }
  },
);
refundRoutes.get(
  "/payment-attempts/:paymentAttemptId/refunds",
  authMiddleware,
  async (req, res) => {
    try {
      const p = pagination(req.query);
      res
        .status(200)
        .json(
          await service.list(
            req.user,
            req.params.paymentAttemptId,
            filters(req.query),
            p.page,
            p.limit,
          ),
        );
    } catch (error) {
      handle(error, res);
    }
  },
);
refundRoutes.get("/refunds/:refundId", authMiddleware, async (req, res) => {
  try {
    res.status(200).json(await service.get(req.user, req.params.refundId));
  } catch (error) {
    handle(error, res);
  }
});
