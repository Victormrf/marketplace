import { ProductCategory } from "@prisma/client";
import { Request, Response, Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import uploadProductImage from "../middlewares/uploadProductImage";
import {
  ProductForbiddenError,
  ProductService,
} from "../services/productService";
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  PaginationInput,
  parsePaginationValue,
  ProductReadFilters,
} from "../types/productRead";
import {
  ConflictError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";

export const productRoutes = Router();
const productService = new ProductService();

function readPagination(query: Record<string, unknown>): PaginationInput {
  try {
    return {
      page: parsePaginationValue(query.page, DEFAULT_PAGE, "page"),
      limit: parsePaginationValue(query.limit, DEFAULT_LIMIT, "limit"),
    };
  } catch (error) {
    throw new ValidationError((error as Error).message);
  }
}

function readCategory(value: string): ProductCategory {
  if (!Object.values(ProductCategory).includes(value as ProductCategory)) {
    throw new ValidationError("Invalid category");
  }
  return value as ProductCategory;
}

function readOptionalString(query: Record<string, unknown>, field: string): string | undefined {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`Invalid ${field}`);
  }
  return value.trim();
}

function readInStock(query: Record<string, unknown>): boolean | undefined {
  const value = query.inStock;
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ValidationError("Invalid inStock");
}

export function readCatalogFilters(
  query: Record<string, unknown>,
  overrides: Partial<ProductReadFilters> = {}
): ProductReadFilters {
  const search =
    overrides.search !== undefined
      ? readOptionalString({ search: overrides.search }, "search")
      : readOptionalString(query, "search");
  const sellerId = overrides.sellerId ?? readOptionalString(query, "sellerId");
  const categoryValue = overrides.category ?? readOptionalString(query, "category");
  const category =
    typeof categoryValue === "string" ? readCategory(categoryValue) : categoryValue;
  const inStock = overrides.inStock ?? readInStock(query);

  return {
    ...(search ? { search } : {}),
    ...(sellerId ? { sellerId } : {}),
    ...(category ? { category } : {}),
    ...(inStock !== undefined ? { inStock } : {}),
  };
}

function sendProductError(error: unknown, res: Response) {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof ProductForbiddenError) {
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
  res.status(500).json({ message: "Internal Server Error" });
}

function inputWithUploadedImage(req: Request): Record<string, unknown> {
  return {
    ...req.body,
    ...(req.file ? { image: (req.file as { path: string }).path } : {}),
  };
}

productRoutes.post(
  "/",
  authMiddleware,
  uploadProductImage.single("image"),
  async (req, res) => {
    try {
      const product = await productService.createProduct(
        { id: req.user.id, role: req.user.role },
        inputWithUploadedImage(req)
      );
      res.status(201).json(product);
    } catch (error) {
      sendProductError(error, res);
    }
  }
);

productRoutes.get("/", async (req, res) => {
  try {
    res.status(200).json(
      await productService.listProducts(
        readCatalogFilters(req.query),
        readPagination(req.query)
      )
    );
  } catch (error) {
    sendProductError(error, res);
  }
});

productRoutes.get("/search", async (req, res) => {
  try {
    if (typeof req.query.q !== "string") throw new ValidationError("Invalid search query");
    res.status(200).json(
      await productService.listProducts(
        readCatalogFilters(req.query, { search: req.query.q }),
        readPagination(req.query)
      )
    );
  } catch (error) {
    sendProductError(error, res);
  }
});

productRoutes.get("/seller/:sellerId", async (req, res) => {
  try {
    res.status(200).json(
      await productService.listProducts(
        readCatalogFilters(req.query, { sellerId: req.params.sellerId }),
        readPagination(req.query)
      )
    );
  } catch (error) {
    sendProductError(error, res);
  }
});

productRoutes.get("/category/:category", async (req, res) => {
  try {
    res.status(200).json(
      await productService.listProducts(
        readCatalogFilters(req.query, { category: readCategory(req.params.category) }),
        readPagination(req.query)
      )
    );
  } catch (error) {
    sendProductError(error, res);
  }
});


productRoutes.get("/:productIds", async (req, res) => {
  try {
    const ids = req.params.productIds.split(",");
    if (ids.length === 1) {
      res.status(200).json(await productService.getProductReadById(ids[0]));
      return;
    }
    res.status(200).json(
      await productService.getProductsReadByIds(ids, readPagination(req.query))
    );
  } catch (error) {
    sendProductError(error, res);
  }
});

productRoutes.put(
  "/:productId",
  authMiddleware,
  uploadProductImage.single("image"),
  async (req, res) => {
    try {
      const product = await productService.updateProduct(
        req.params.productId,
        { id: req.user.id, role: req.user.role },
        inputWithUploadedImage(req)
      );
      res.status(200).json(product);
    } catch (error) {
      sendProductError(error, res);
    }
  }
);

productRoutes.delete(
  "/:productId",
  authMiddleware,
  async (req, res) => {
    try {
      await productService.deactivateProduct(req.params.productId, {
        id: req.user.id,
        role: req.user.role,
      });
      res.status(204).send();
    } catch (error) {
      sendProductError(error, res);
    }
  }
);
