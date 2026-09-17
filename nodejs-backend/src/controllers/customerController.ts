import { Request, Response, Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";
import { customerService } from "../services/customerService";
import {
  ConflictError,
  ExistingProfileError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";

export const customerRoutes = Router();

function sendError(error: unknown, res: Response) {
  if (error instanceof ValidationError)
    return res.status(400).json({ error: error.message });
  if (error instanceof ForbiddenError)
    return res.status(403).json({ error: error.message });
  if (error instanceof ObjectNotFoundError)
    return res.status(404).json({ error: error.message });
  if (error instanceof ExistingProfileError || error instanceof ConflictError)
    return res.status(409).json({ error: error.message });
  return res.status(500).json({ message: "Internal Server Error" });
}

customerRoutes.post("/", authMiddleware, async (req, res) => {
  try {
    res
      .status(201)
      .json(
        await customerService.createCustomerProfile(
          req.user.id,
          req.body || {},
        ),
      );
  } catch (error) {
    sendError(error, res);
  }
});

customerRoutes.get(
  "/all",
  authMiddleware,
  roleMiddleware("ADMIN"),
  async (req, res) => {
    try {
      res
        .status(200)
        .json({ profiles: await customerService.getAllCustomers() });
    } catch (error) {
      sendError(error, res);
    }
  },
);

customerRoutes.get("/", authMiddleware, async (req, res) => {
  try {
    res
      .status(200)
      .json({ profile: await customerService.getCustomerProfile(req.user.id) });
  } catch (error) {
    sendError(error, res);
  }
});

customerRoutes.put("/", authMiddleware, async (req, res) => {
  try {
    res
      .status(200)
      .json(
        await customerService.updateCustomerProfile(
          req.user.id,
          req.body || {},
        ),
      );
  } catch (error) {
    sendError(error, res);
  }
});

customerRoutes.delete(
  "/:userId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  async (req, res) => {
    try {
      await customerService.deleteCustomerProfile();
      res.status(204).send();
    } catch (error) {
      sendError(error, res);
    }
  },
);
