import { DeliveryStatus } from "@prisma/client";
import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { DeliveryService } from "../services/deliveryService";
import type {
  DeliveryStatusInput,
  DeliveryTrackingInput,
} from "../types/delivery";
import {
  ConflictError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";

export const deliveryRoutes = Router();
const service = new DeliveryService();

function errorResponse(
  error: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } },
): void {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof ForbiddenError) {
    res.status(403).json({ error: error.message });
    return;
  }
  if (error instanceof ObjectNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  if (error instanceof ConflictError) {
    res.status(409).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: "Internal Server Error" });
}

function tracking(
  body: Record<string, unknown>,
  allowEmpty = false,
): DeliveryTrackingInput {
  const allowed = ["trackingCode", "carrier", "estimatedDelivery"];
  if (
    (!allowEmpty && !Object.keys(body).length) ||
    Object.keys(body).some((key) => !allowed.includes(key))
  )
    throw new ValidationError("Invalid tracking fields");
  const result: DeliveryTrackingInput = {};
  if (Object.prototype.hasOwnProperty.call(body, "trackingCode"))
    result.trackingCode = body.trackingCode as string | null;
  if (Object.prototype.hasOwnProperty.call(body, "carrier"))
    result.carrier = body.carrier as string | null;
  if (Object.prototype.hasOwnProperty.call(body, "estimatedDelivery"))
    result.estimatedDelivery =
      body.estimatedDelivery === null
        ? null
        : new Date(body.estimatedDelivery as string);
  return result;
}

deliveryRoutes.post(
  "/seller-orders/:sellerOrderId/delivery",
  authMiddleware,
  async (req, res) => {
    try {
      res
        .status(201)
        .json(
          await service.createDelivery(
            req.user,
            req.params.sellerOrderId,
            tracking((req.body || {}) as Record<string, unknown>, true),
          ),
        );
    } catch (error) {
      errorResponse(error, res);
    }
  },
);

deliveryRoutes.get(
  "/seller-orders/:sellerOrderId/delivery",
  authMiddleware,
  async (req, res) => {
    try {
      res
        .status(200)
        .json(
          await service.getBySellerOrder(req.user, req.params.sellerOrderId),
        );
    } catch (error) {
      errorResponse(error, res);
    }
  },
);

deliveryRoutes.get(
  "/deliveries/:deliveryId",
  authMiddleware,
  async (req, res) => {
    try {
      res.status(200).json(await service.get(req.user, req.params.deliveryId));
    } catch (error) {
      errorResponse(error, res);
    }
  },
);

deliveryRoutes.get(
  "/deliveries/:deliveryId/history",
  authMiddleware,
  async (req, res) => {
    try {
      res
        .status(200)
        .json(await service.history(req.user, req.params.deliveryId));
    } catch (error) {
      errorResponse(error, res);
    }
  },
);

deliveryRoutes.patch(
  "/deliveries/:deliveryId/status",
  authMiddleware,
  async (req, res) => {
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      if (
        Object.keys(body).some((key) => key !== "status" && key !== "reason") ||
        typeof body.status !== "string" ||
        !Object.values(DeliveryStatus).includes(body.status as DeliveryStatus)
      )
        throw new ValidationError("Invalid delivery status payload");
      const input: DeliveryStatusInput = {
        status: body.status as DeliveryStatus,
        reason: body.reason as string | null | undefined,
      };
      res
        .status(200)
        .json(await service.transition(req.user, req.params.deliveryId, input));
    } catch (error) {
      errorResponse(error, res);
    }
  },
);

deliveryRoutes.patch(
  "/deliveries/:deliveryId/tracking",
  authMiddleware,
  async (req, res) => {
    try {
      res
        .status(200)
        .json(
          await service.updateTracking(
            req.user,
            req.params.deliveryId,
            tracking((req.body || {}) as Record<string, unknown>),
          ),
        );
    } catch (error) {
      errorResponse(error, res);
    }
  },
);
