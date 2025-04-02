import { Router } from "express";
import { CustomerService } from "../services/customerService";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  EntityNotFoundError,
  ExistingProfileError,
} from "../utils/customErrors";
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

customerRoutes.put("/profile/:userId", authMiddleware, async (req, res) => {
  const requestorId = req.user.id;
  const requestorRole = req.user.role;
  const { userId } = req.params;
  const updateData = req.body;

  if (requestorId !== userId && requestorRole !== "admin") {
    res.status(403).json({ error: `role: ${requestorRole}` });
    return;
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update." });
    return;
  }

  try {
    const updatedCustomer = await customerService.updateCustomerProfile(
      userId,
      req.body
    );
    res.json(updatedCustomer);
  } catch (error) {
    if (error instanceof EntityNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
});

customerRoutes.delete(
  "/profile/:userId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const { userId } = req.params;

    try {
      await customerService.deleteCustomerProfile(userId);
      res.status(204).json({ message: "Customer was successfully deleted" });
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error });
    }
  }
);
