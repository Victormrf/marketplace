import { Router } from "express";
import { RefundService } from "../services/refundService";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  ObjectNotFoundError,
  ObjectsNotFoundError,
  ValidationError,
} from "../utils/customErrors";
import { roleMiddleware } from "../middlewares/roleMiddleware";

export const refundRoutes = Router();
const refundService = new RefundService();

refundRoutes.post("/", authMiddleware, async (req, res) => {
  const { paymentId, reason, amount } = req.body;

  try {
    const refund = await refundService.requestRefund(paymentId, reason, amount);
    res.status(201).json(refund);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error });
    }
  }
});

refundRoutes.get("/:refundId", authMiddleware, async (req, res) => {
  const { refundId } = req.params;

  try {
    const refund = await refundService.getRefundById(refundId);
    res.status(200).json(refund);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error });
    }
  }
});

// refundRoutes.get("/customer/:customerId", authMiddleware, async (req, res) => {
//   const { customerId } = req.params;

//   try {
//     const refunds = await refundService.getRefundsByCustomer(customerId);
//     res.status(200).json(refunds);
//   } catch (error) {
//     if (error instanceof ObjectsNotFoundError) {
//       res.status(404).json({ error: error.message });
//     } else {
//       res.status(500).json({ error });
//     }
//   }
// });

refundRoutes.put("/:refundId/status", authMiddleware, async (req, res) => {
  const { refundId } = req.params;
  const { status } = req.body;

  try {
    const updatedRefund = await refundService.updateRefundStatus(
      refundId,
      status
    );
    res.status(200).json(updatedRefund);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error });
    }
  }
});

refundRoutes.delete(
  "/:refundId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  async (req, res) => {
    const { refundId } = req.params;

    try {
      await refundService.deleteRefund(refundId);
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
