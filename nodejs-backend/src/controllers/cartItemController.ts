import { Router } from "express";
import { CartItemService } from "../services/cartItemService";

export const cartItemRoutes = Router();
const cartItemService = new CartItemService();

cartItemRoutes.post("/", async (req, res) => {
  const { userId, productId, quantity } = req.body;
  const item = await cartItemService.addToCart({ userId, productId, quantity });
  res.status(201).json(item);
});

cartItemRoutes.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const items = await cartItemService.getUserCart(userId);
  res.status(200).json(items);
});

cartItemRoutes.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  const updated = await cartItemService.updateQuantity(id, quantity);
  res.status(200).json(updated);
});

cartItemRoutes.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await cartItemService.removeFromCart(id);
  res.sendStatus(204);
});

cartItemRoutes.delete("/clear/:userId", async (req, res) => {
  const { userId } = req.params;
  await cartItemService.clearUserCart(userId);
  res.sendStatus(204);
});

//TO DO: Implementar try catch para tratamento de erros
