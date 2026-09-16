import { Request, Response, Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { checkoutService } from "../services/checkoutService";
import { ConflictError, ForbiddenError, ObjectNotFoundError, ValidationError } from "../utils/customErrors";

export const checkoutRoutes = Router();
checkoutRoutes.use(authMiddleware);

checkoutRoutes.post("/", async (req: Request, res: Response) => {
  try {
    const execution = await checkoutService.checkout(req.user.id, req.body ?? {}, req.header("Idempotency-Key") ?? "");
    if (execution.replayed) res.setHeader("Idempotency-Replayed", "true");
    res.status(execution.replayed ? 200 : 201).json(execution.result);
  } catch (error) {
    if (error instanceof ValidationError) { res.status(400).json({ error: error.message }); return; }
    if (error instanceof ForbiddenError) { res.status(403).json({ error: error.message }); return; }
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: error.message }); return; }
    if (error instanceof ConflictError) { res.status(409).json({ error: error.message }); return; }
    res.status(500).json({ message: "Internal Server Error" });
  }
});
