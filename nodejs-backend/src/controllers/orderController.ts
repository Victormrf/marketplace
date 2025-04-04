import { Router } from "express";
import { OrderService } from "../services/orderService";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  ObjectNotFoundError,
  ObjectsNotFoundError,
  ValidationError,
} from "../utils/customErrors";
import { adminMiddleware } from "../middlewares/isAdminMiddleware";
import { error } from "console";

export const orderRoutes = Router();
const orderService = new OrderService();

orderRoutes.post("/", authMiddleware, async (req, res) => {
  const { customerId, totalPrice, status } = req.body;

  try {
    const newOrder = orderService.createOrder({
      customerId,
      totalPrice,
      status,
    });
    res.status(201).json({ message: "Order generated successfully", newOrder });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ message: "Internal Server Error" });
      return;
    }
  }
});

orderRoutes.get("/:orderId", authMiddleware, async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = orderService.getOrderById(orderId);
    res.status(200).json({ order });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ message: "Internal Server Error" });
      return;
    }
  }
});

orderRoutes.get("/customer/:customerId", authMiddleware, async (req, res) => {
  const { customerId } = req.params;

  try {
    const orders = orderService.getOrdersByCustomerId(customerId);
    res.status(200).json({ orders });
  } catch (error) {
    if (error instanceof ObjectsNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ message: "Internal Server Error" });
      return;
    }
  }
});

orderRoutes.get("/customer/:customerId", authMiddleware, async (req, res) => {
  const { customerId } = req.params;

  try {
    const orders = orderService.getOrdersByCustomerId(customerId);
    res.status(200).json({ orders });
  } catch (error) {
    if (error instanceof ObjectsNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ message: "Internal Server Error" });
      return;
    }
  }
});

orderRoutes.put(
  "/:orderId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const { orderId } = req.params;
    const updateData = req.body;

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    try {
      const updatedOrder = orderService.updateOrder(orderId, updateData);
      res.status(200).json(updatedOrder);
    } catch {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
  }
);

orderRoutes.delete(
  "/:orderId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const { orderId } = req.params;

    try {
      const deletedOrder = orderService.deleteOrder(orderId);
      res.status(200).json(deletedOrder);
    } catch {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
  }
);
