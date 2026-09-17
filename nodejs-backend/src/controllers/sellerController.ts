import { Response, Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";
import uploadSellerLogo from "../middlewares/uploadSellerLogo";
import { sellerService } from "../services/sellerService";
import {
  ConflictError,
  ExistingProfileError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";

export const sellerRoutes = Router();

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

sellerRoutes.post(
  "/",
  authMiddleware,
  uploadSellerLogo.single("logo"),
  async (req, res) => {
    try {
      res.status(201).json(
        await sellerService.createSellerProfile(req.user.id, {
          ...(req.body || {}),
          ...(req.file ? { logo: (req.file as { path: string }).path } : {}),
        }),
      );
    } catch (error) {
      sendError(error, res);
    }
  },
);

sellerRoutes.get(
  "/all",
  authMiddleware,
  roleMiddleware("ADMIN"),
  async (req, res) => {
    try {
      res.status(200).json({ profiles: await sellerService.getAllSellers() });
    } catch (error) {
      sendError(error, res);
    }
  },
);

sellerRoutes.get("/", authMiddleware, async (req, res) => {
  try {
    res
      .status(200)
      .json({ profile: await sellerService.getSellerProfile(req.user.id) });
  } catch (error) {
    sendError(error, res);
  }
});

sellerRoutes.put(
  "/",
  authMiddleware,
  uploadSellerLogo.single("logo"),
  async (req, res) => {
    try {
      res.status(200).json(
        await sellerService.updateSellerProfile(req.user.id, {
          ...(req.body || {}),
          ...(req.file ? { logo: (req.file as { path: string }).path } : {}),
        }),
      );
    } catch (error) {
      sendError(error, res);
    }
  },
);

sellerRoutes.delete("/:userId", authMiddleware, async (req, res) => {
  try {
    await sellerService.deactivateSeller(req.params.userId, req.user);
    res.status(204).send();
  } catch (error) {
    sendError(error, res);
  }
});
