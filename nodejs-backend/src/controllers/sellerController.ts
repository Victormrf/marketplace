import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  ObjectNotFoundError,
  ExistingProfileError,
  ValidationError,
} from "../utils/customErrors";
import { SellerService } from "../services/sellerService";
import { roleMiddleware } from "../middlewares/roleMiddleware";
import uploadSellerLogo from "../middlewares/uploadSellerLogo";

export const sellerRoutes = Router();
const sellerService = new SellerService();

sellerRoutes.post(
  "/",
  authMiddleware,
  uploadSellerLogo.single("logo"),
  async (req, res) => {
    const userId = req.user.id;
    const { storeName, description } = req.body;

    const logoUrl = (req.file as any)?.path || null;

    try {
      const newProfile = await sellerService.createSellerProfile(userId, {
        storeName,
        description,
        logo: logoUrl,
      });
      res
        .status(201)
        .json({ message: "Seller profile created with success", newProfile });
    } catch (error) {
      if (error instanceof ExistingProfileError) {
        res.status(409).json({ error: error.message });
      } else if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: error });
      }
    }
  }
);

sellerRoutes.get(
  "/all",
  authMiddleware,
  roleMiddleware("ADMIN"),
  async (req, res) => {
    try {
      const profiles = await sellerService.getAllSellers();
      res.status(200).json({ profiles });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  }
);

sellerRoutes.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const profile = await sellerService.getSellerProfile(userId);
    res.status(200).json({ profile });
  } catch (error: any) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || "Internal Server Error" });
    return;
  }
});

sellerRoutes.put("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const updateData = req.body;

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
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
});

sellerRoutes.delete(
  "/:userId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  async (req, res) => {
    const { userId } = req.params;

    try {
      await sellerService.deleteSellerProfile(userId);
      res.status(204).json({ message: "Seller was successfully deleted" });
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error });
    }
  }
);
