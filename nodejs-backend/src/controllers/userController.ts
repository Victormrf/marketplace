import { Router } from "express";
import { UserService } from "../services/userService";
import {
  ConflictError,
  UserNotFoundError,
  ValidationError,
} from "../utils/customErrors";
import { authMiddleware } from "../middlewares/authMiddleware";
import { adminMiddleware } from "../middlewares/isAdminMiddleware";

export const userRoutes = Router();
const userService = new UserService();

userRoutes.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const newUser = await userService.create({ name, email, password, role });
    res.status(201).json(newUser);
  } catch (error) {
    if (error instanceof ConflictError) {
      res.status(409).json({ error: error.message });
    } else if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

userRoutes.get(
  "/:userId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const { userId } = req.params;

    try {
      const user = await userService.getById(userId);
      res.json(user);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  }
);

userRoutes.put(
  "/:userId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const { userId } = req.params;
    const updateData = req.body;

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "No fields to update" });
    }

    try {
      const updatedUser = await userService.update(userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        res.status(404).json({ error: error.message });
      }
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

userRoutes.delete(
  "/:userId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const { userId } = req.params;

    try {
      await userService.delete(userId);
      res.status(204);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);
