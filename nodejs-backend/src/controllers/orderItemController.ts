import { Router } from "express";
import { OrderItemService } from "../services/orderItemService";
import { authMiddleware } from "../middlewares/authMiddleware";
import { ObjectNotFoundError } from "../utils/customErrors";

export const orderItemRoutes = Router();
const orderItemService = new OrderItemService();

// Atualizar quantidade do item
orderItemRoutes.put(
  "/:itemId/setQuantity",
  authMiddleware,
  async (req, res) => {
    const { itemId } = req.params;
    const { quantity } = req.body;

    try {
      const updatedItem = await orderItemService.updateItemQuantity(
        itemId,
        quantity
      );
      res.status(200).json(updatedItem);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error });
      }
    }
  }
);

// Remover item do pedido
orderItemRoutes.delete("/:itemId", authMiddleware, async (req, res) => {
  const { itemId } = req.params;

  try {
    await orderItemService.removeItemFromOrder(itemId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error });
    }
  }
});

// Listar itens de um pedido
orderItemRoutes.get("/", authMiddleware, async (req, res) => {
  const { orderId } = req.params;

  try {
    const items = await orderItemService.getItemsByOrderId(orderId);
    res.status(200).json(items);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error });
    }
  }
});
