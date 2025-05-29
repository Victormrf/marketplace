import { Router } from "express";
import { CustomerService } from "../services/customerService";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  ObjectNotFoundError,
  ExistingProfileError,
  ValidationError,
} from "../utils/customErrors";
import { roleMiddleware } from "../middlewares/roleMiddleware";

export const customerRoutes = Router();
const customerService = new CustomerService();

customerRoutes.post("/", authMiddleware, async (req, res) => {
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
    } else if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error });
    }
  }
});

customerRoutes.get(
  "/all",
  authMiddleware,
  roleMiddleware("ADMIN"),
  async (req, res) => {
    try {
      const profiles = await customerService.getAllCustomers();
      res.status(200).json({ profiles });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  }
);

customerRoutes.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const profile = await customerService.getCustomerProfile(userId);
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

customerRoutes.put("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const updateData = req.body;

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
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
});

customerRoutes.delete(
  "/:userId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  async (req, res) => {
    const { userId } = req.params;

    try {
      await customerService.deleteCustomerProfile(userId);
      res.status(204).json({ message: "Customer was successfully deleted" });
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error });
    }
  }
);
