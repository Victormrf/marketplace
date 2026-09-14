import { Request, Response, Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";
import { userService } from "../services/userService";
import { ConflictError, ForbiddenError, ObjectNotFoundError, ValidationError } from "../utils/customErrors";

export const userRoutes = Router();

function sendError(error: unknown, res: Response) {
  if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
  if (error instanceof ForbiddenError) return res.status(403).json({ error: error.message });
  if (error instanceof ObjectNotFoundError) return res.status(404).json({ error: error.message });
  if (error instanceof ConflictError) return res.status(409).json({ error: error.message });
  return res.status(500).json({ message: "Internal Server Error" });
}

userRoutes.post("/register", async (req, res) => {
  try {
    res.status(201).json(await userService.create(req.body || {}));
  } catch (error) {
    sendError(error, res);
  }
});

userRoutes.get("/me", authMiddleware, async (req, res) => {
  try {
    res.status(200).json(await userService.getById(req.user.id));
  } catch (error) {
    sendError(error, res);
  }
});

userRoutes.put("/", authMiddleware, async (req, res) => {
  try {
    res.status(200).json(await userService.update(req.user.id, req.body || {}));
  } catch (error) {
    sendError(error, res);
  }
});

userRoutes.delete("/:userId", authMiddleware, roleMiddleware("ADMIN"), async (req, res) => {
  try {
    await userService.deactivate(req.params.userId, req.user);
    res.status(204).send();
  } catch (error) {
    sendError(error, res);
  }
});
