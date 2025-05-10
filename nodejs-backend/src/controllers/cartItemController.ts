import { Router } from "express";
import { CartItemService } from "../services/cartItemService";
import { ObjectNotFoundError, ValidationError } from "../utils/customErrors";
import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";

export const cartItemRoutes = Router();
const cartItemService = new CartItemService();

cartItemRoutes.post(
  "/",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.user.id;
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
  }
);

cartItemRoutes.get(
  "/",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  async (req, res) => {
    const userId = req.user.id;
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
  }
);

cartItemRoutes.put(
  "/product/:productId",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;
    try {
      const updated = await cartItemService.updateQuantity(productId, quantity);
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
  }
);

cartItemRoutes.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  async (req, res) => {
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
  }
);

cartItemRoutes.delete(
  "/product/:productId",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  async (req, res) => {
    const { productId } = req.params;
    try {
      await cartItemService.removeProductFromCart(productId);
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
  }
);

cartItemRoutes.delete(
  "/clear/:userId",
  authMiddleware,
  roleMiddleware("CUSTOMER"),
  async (req, res) => {
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
  }
);
