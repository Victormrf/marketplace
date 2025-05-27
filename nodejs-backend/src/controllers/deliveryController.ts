import { Router } from "express";
import { DeliveryService } from "../services/deliveryService";
import { authMiddleware } from "../middlewares/authMiddleware";
import { ObjectNotFoundError, ValidationError } from "../utils/customErrors";
import { roleMiddleware } from "../middlewares/roleMiddleware";

export const deliveryRoutes = Router();
const deliveryService = new DeliveryService();

deliveryRoutes.post("/", authMiddleware, async (req, res) => {
  const { orderId, status, trackingCode, estimatedDelivery } = req.body;

  try {
    const delivery = await deliveryService.createDelivery(
      orderId,
      status,
      trackingCode,
      estimatedDelivery ? new Date(estimatedDelivery) : undefined
    );
    res.status(201).json(delivery);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error });
    }
  }
});

deliveryRoutes.get("/order/:orderId", authMiddleware, async (req, res) => {
  const { orderId } = req.params;

  try {
    const delivery = await deliveryService.getDeliveryDetails(orderId);
    res.status(200).json(delivery);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error });
    }
  }
});

deliveryRoutes.put("/:orderId/status", authMiddleware, async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    const updated = await deliveryService.updateDeliveryStatus(orderId, status);
    res.status(200).json(updated);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error });
    }
  }
});

deliveryRoutes.put("/:orderId/tracking", authMiddleware, async (req, res) => {
  const { orderId } = req.params;
  const { trackingCode, estimatedDelivery } = req.body;

  try {
    const updated = await deliveryService.updateTrackingInfo(
      orderId,
      trackingCode,
      new Date(estimatedDelivery)
    );
    res.status(200).json(updated);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error });
    }
  }
});

deliveryRoutes.delete(
  "/:orderId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  async (req, res) => {
    const { orderId } = req.params;

    try {
      await deliveryService.deleteDelivery(orderId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error });
      }
    }
  }
);
