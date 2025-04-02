import { Router } from "express";
import { CustomerService } from "../services/customerService";
import { authMiddleware } from "../middlewares/authMiddleware";
import { ExistingProfileError } from "../utils/customErrors";
import { adminMiddleware } from "../middlewares/isAdminMiddleware";

export const customerRoutes = Router();
const customerService = new CustomerService();

customerRoutes.post("/profile", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { address, phone } = req.body;

  try {
    const newProfile = await customerService.createCustomerProfile(userId, {
      address,
      phone,
    });
    res
      .status(201)
      .json({ message: "Customer profile created with success", newProfile });
  } catch (error) {
    if (error instanceof ExistingProfileError) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: error });
    }
  }
});

customerRoutes.get("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const profiles = await customerService.getAllCustomers();
    res.status(200).json({ profiles });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});
