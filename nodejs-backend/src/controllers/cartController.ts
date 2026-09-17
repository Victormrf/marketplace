import { Request, Response, Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { cartService } from "../services/cartService";
import {
  ConflictError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";

export const cartRoutes = Router();
cartRoutes.use(authMiddleware);

function sendError(error: unknown, res: Response) {
  if (error instanceof ValidationError)
    return res.status(400).json({ error: error.message });
  if (error instanceof ForbiddenError)
    return res.status(403).json({ error: error.message });
  if (error instanceof ObjectNotFoundError)
    return res.status(404).json({ error: error.message });
  if (error instanceof ConflictError)
    return res.status(409).json({ error: error.message });
  return res.status(500).json({ message: "Internal Server Error" });
}

function userId(req: Request): string {
  return req.user.id;
}

cartRoutes.get("/", async (req, res) => {
  try {
    res.status(200).json(await cartService.getCart(userId(req)));
  } catch (error) {
    sendError(error, res);
  }
});

cartRoutes.post("/items", async (req, res) => {
  try {
    res
      .status(201)
      .json(await cartService.addItem(userId(req), req.body ?? {}));
  } catch (error) {
    sendError(error, res);
  }
});

cartRoutes.put("/items/:productId", async (req, res) => {
  try {
    res
      .status(200)
      .json(
        await cartService.updateItem(
          userId(req),
          req.params.productId,
          req.body ?? {},
        ),
      );
  } catch (error) {
    sendError(error, res);
  }
});

cartRoutes.delete("/items", async (req, res) => {
  try {
    await cartService.clear(userId(req));
    res.status(204).send();
  } catch (error) {
    sendError(error, res);
  }
});

cartRoutes.delete("/items/:productId", async (req, res) => {
  try {
    await cartService.removeItem(userId(req), req.params.productId);
    res.status(204).send();
  } catch (error) {
    sendError(error, res);
  }
});
