import { Request, Response, Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { DEFAULT_LIMIT, DEFAULT_PAGE, parsePaginationValue } from "../types/productRead";
import {
  InventoryForbiddenError,
  InventoryService,
} from "../services/inventoryService";
import { ConflictError, ObjectNotFoundError, ValidationError } from "../utils/customErrors";

export const inventoryRoutes = Router();
const service = new InventoryService();

function pagination(query: Record<string, unknown>) {
  return {
    page: parsePaginationValue(query.page, DEFAULT_PAGE, "page"),
    limit: parsePaginationValue(query.limit, DEFAULT_LIMIT, "limit"),
  };
}

function actor(req: Request) {
  return { id: req.user.id, role: req.user.role };
}

function sendError(error: unknown, res: Response) {
  if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
  if (error instanceof InventoryForbiddenError) return res.status(403).json({ error: error.message });
  if (error instanceof ObjectNotFoundError) return res.status(404).json({ error: error.message });
  if (error instanceof ConflictError) return res.status(409).json({ error: error.message });
  return res.status(500).json({ message: "Internal Server Error" });
}

inventoryRoutes.use(authMiddleware);

inventoryRoutes.get("/products/:productId", async (req, res) => {
  try {
    res.status(200).json(await service.getInventory(req.params.productId, actor(req)));
  } catch (error) {
    sendError(error, res);
  }
});

inventoryRoutes.get("/products/:productId/movements", async (req, res) => {
  try {
    res.status(200).json(await service.listMovements(req.params.productId, actor(req), pagination(req.query)));
  } catch (error) {
    sendError(error, res);
  }
});

inventoryRoutes.post("/products/:productId/restock", async (req, res) => {
  try {
    res.status(200).json(await service.restock(req.params.productId, actor(req), req.body));
  } catch (error) {
    sendError(error, res);
  }
});

inventoryRoutes.post("/products/:productId/adjustments", async (req, res) => {
  try {
    res.status(200).json(await service.adjust(req.params.productId, actor(req), req.body));
  } catch (error) {
    sendError(error, res);
  }
});
