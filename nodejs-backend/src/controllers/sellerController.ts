import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  EntityNotFoundError,
  ExistingProfileError,
} from "../utils/customErrors";
import { SellerService } from "../services/sellerService";
import { adminMiddleware } from "../middlewares/isAdminMiddleware";

export const sellerRoutes = Router();
const sellerService = new SellerService();

sellerRoutes.post("/profile", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { storeName, description } = req.body;

  try {
    const newProfile = await sellerService.createSellerProfile(userId, {
      storeName,
      description,
    });
    res
      .status(201)
      .json({ message: "Seller profile created with success", newProfile });
  } catch (error) {
    if (error instanceof ExistingProfileError) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: error });
    }
  }
});

sellerRoutes.get("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const profiles = await sellerService.getAllSellers();
    res.status(200).json({ profiles });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

sellerRoutes.put("/profile/:userId", authMiddleware, async (req, res) => {
  const requestorId = req.user.id;
  const requestorRole = req.user.role;
  const { userId } = req.params;
  const updateData = req.body;

  if (requestorId !== userId && requestorRole !== "admin") {
    res.status(403).json({ error: "Access denied." });
    return;
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  try {
    const updatedSeller = await sellerService.updateSellerProfile(
      userId,
      req.body
    );
    res.json(updatedSeller);
  } catch (error) {
    if (error instanceof EntityNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
});

sellerRoutes.delete(
  "/profile/:userId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const { userId } = req.params;

    try {
      await sellerService.deleteSellerProfile(userId);
      res.status(204).json({ message: "Seller was successfully deleted" });
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error });
    }
  }
);
