import { Router } from "express";
import { PaymentService } from "../services/paymentService";
import { authMiddleware } from "../middlewares/authMiddleware";
import { ObjectNotFoundError, ValidationError } from "../utils/customErrors";

export const paymentRoutes = Router();
const paymentService = new PaymentService();

paymentRoutes.post("/", authMiddleware, async (req, res) => {
  const { orderId, amount } = req.body;

  try {
    const payment = await paymentService.processPayment(orderId, amount);
    res.status(201).json(payment);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ error });
      return;
    }
  }
});

paymentRoutes.get("/order/:orderId", authMiddleware, async (req, res) => {
  const { orderId } = req.params;

  try {
    const payment = await paymentService.getPaymentDetails(orderId);
    res.status(200).json(payment);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ error });
      return;
    }
  }
});

paymentRoutes.get("/customer/:customerId", authMiddleware, async (req, res) => {
  const { customerId } = req.params;

  try {
    const payments = await paymentService.getPaymentsByCustomer(customerId);
    res.status(200).json(payments);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error });
    }
  }
});

paymentRoutes.put("/:paymentId", authMiddleware, async (req, res) => {
  const requestorRole = req.user.role;
  const { paymentId } = req.params;
  const updateData = req.body;

  if (requestorRole !== "admin" && requestorRole !== "seller") {
    res.status(403).json({ error: "Access denied." });
    return;
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  try {
    const updatedPayment = await paymentService.updatePayment(
      paymentId,
      updateData
    );
    res.status(200).json(updatedPayment);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
});

paymentRoutes.put(
  "/:paymentId/changeStatus",
  authMiddleware,
  async (req, res) => {
    const { paymentId } = req.params;
    const { status } = req.body;

    try {
      const updatedPayment = await paymentService.updatePaymentStatus(
        paymentId,
        status
      );
      res.status(200).json(updatedPayment);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      } else {
        res.status(500).json({ error });
        return;
      }
    }
  }
);

paymentRoutes.delete("/:paymentId", authMiddleware, async (req, res) => {
  const { paymentId } = req.params;

  try {
    await paymentService.deletePayment(paymentId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    } else {
      res.status(500).json({ error });
      return;
    }
  }
});
