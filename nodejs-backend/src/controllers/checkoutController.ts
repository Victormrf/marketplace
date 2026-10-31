import { Request, Response, Router } from "express";
import { Prisma } from "@prisma/client";
import { authMiddleware } from "../middlewares/authMiddleware";
import { checkoutService } from "../services/checkoutService";
import {
  ConflictError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";
import { logger } from "../utils/logger";
import type { CheckoutFailureCode } from "../types/checkout";

function failureCode(error: unknown): CheckoutFailureCode {
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : error instanceof Prisma.PrismaClientInitializationError
        ? error.errorCode
        : undefined;
  switch (code) {
    case "P1001":
    case "P1017":
      return "DATABASE_UNAVAILABLE";
    case "P1002":
    case "P1008":
    case "P2024":
      return "DATABASE_TIMEOUT";
    default:
      return "UNEXPECTED_CHECKOUT_ERROR";
  }
}

export const checkoutRoutes = Router();
checkoutRoutes.use(authMiddleware);

checkoutRoutes.post("/", async (req: Request, res: Response) => {
  try {
    const execution = await checkoutService.checkout(
      req.user.id,
      req.body ?? {},
      req.header("Idempotency-Key") ?? "",
    );
    if (execution.replayed) {
      res.setHeader("Idempotency-Replayed", "true");
    }
    res.status(execution.replayed ? 200 : 201).json(execution.result);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof ForbiddenError) {
      res.status(403).json({ error: error.message });
      return;
    }
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error instanceof ConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    logger.error("checkout.failed", { code: failureCode(error) });
    res.status(500).json({ message: "Internal Server Error" });
  }
});
