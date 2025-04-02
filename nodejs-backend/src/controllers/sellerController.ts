import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { ExistingProfileError } from "../utils/customErrors";
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
