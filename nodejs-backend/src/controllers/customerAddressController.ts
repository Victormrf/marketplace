import { Response, Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { customerAddressService } from "../services/customerAddressService";
import {
  ConflictError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  parsePaginationValue,
} from "../types/productRead";

export const customerAddressRoutes = Router();

function pagination(query: Record<string, unknown>) {
  return {
    page: parsePaginationValue(query.page, DEFAULT_PAGE, "page"),
    limit: parsePaginationValue(query.limit, DEFAULT_LIMIT, "limit"),
  };
}

function sendError(error: unknown, res: Response) {
  if (error instanceof ValidationError)
    return res.status(400).json({ error: error.message });
  if (error instanceof ForbiddenError)
    return res.status(403).json({ error: error.message });
  if (error instanceof ObjectNotFoundError)
    return res.status(404).json({ error: error.message });
  if (error instanceof ConflictError)
    return res.status(409).json({ error: error.message });
  return res.status(500).json({ message: "Internal Server Error" });
}

customerAddressRoutes.use(authMiddleware);

customerAddressRoutes.post("/", async (req, res) => {
  try {
    res
      .status(201)
      .json(await customerAddressService.create(req.user.id, req.body || {}));
  } catch (error) {
    sendError(error, res);
  }
});

customerAddressRoutes.get("/", async (req, res) => {
  try {
    res
      .status(200)
      .json(
        await customerAddressService.list(req.user.id, pagination(req.query)),
      );
  } catch (error) {
    sendError(error, res);
  }
});

customerAddressRoutes.get("/:addressId", async (req, res) => {
  try {
    res
      .status(200)
      .json(
        await customerAddressService.get(req.user.id, req.params.addressId),
      );
  } catch (error) {
    sendError(error, res);
  }
});

customerAddressRoutes.put("/:addressId/default", async (req, res) => {
  try {
    res
      .status(200)
      .json(
        await customerAddressService.setDefault(
          req.user.id,
          req.params.addressId,
        ),
      );
  } catch (error) {
    sendError(error, res);
  }
});

customerAddressRoutes.put("/:addressId", async (req, res) => {
  try {
    res
      .status(200)
      .json(
        await customerAddressService.update(
          req.user.id,
          req.params.addressId,
          req.body || {},
        ),
      );
  } catch (error) {
    sendError(error, res);
  }
});

customerAddressRoutes.delete("/:addressId", async (req, res) => {
  try {
    await customerAddressService.deactivate(req.user.id, req.params.addressId);
    res.status(204).send();
  } catch (error) {
    sendError(error, res);
  }
});
