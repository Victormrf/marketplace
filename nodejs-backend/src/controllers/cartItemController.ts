import { Router } from "express";
import { CartItemService } from "../services/cartItemService";
import { ObjectNotFoundError, ValidationError } from "../utils/customErrors";

export const cartItemRoutes = Router();
const cartItemService = new CartItemService();

cartItemRoutes.post("/", async (req, res) => {
  const { userId, productId, quantity } = req.body;
  try {
    const item = await cartItemService.addToCart({
      userId,
      productId,
      quantity,
    });
    res.status(201).json(item);
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

cartItemRoutes.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const items = await cartItemService.getUserCart(userId);
    res.status(200).json(items);
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

cartItemRoutes.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  try {
    const updated = await cartItemService.updateQuantity(id, quantity);
    res.status(200).json(updated);
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

cartItemRoutes.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await cartItemService.removeFromCart(id);
    res.sendStatus(204);
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

cartItemRoutes.delete("/clear/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    await cartItemService.clearUserCart(userId);
    res.sendStatus(204);
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
