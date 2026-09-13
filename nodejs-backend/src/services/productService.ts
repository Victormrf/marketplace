import { ProductCategory } from "@prisma/client";
import {
  ProductCreateData,
  ProductReadRecord,
  ProductRepositoryPort,
  ProductUpdateData,
  productRepository,
} from "../repositories/productRepository";
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  PaginationInput,
  ProductCollectionDto,
  ProductReadDto,
  ProductReadFilters,
} from "../types/productRead";
import { ConflictError, ObjectNotFoundError, ValidationError } from "../utils/customErrors";

export type ProductActor = { id: string; role?: string };
export type ProductAuthorizationRecord = {
  id: string;
  sellerId: string;
  isActive: boolean;
};
export type ProductCreateInput = Record<string, unknown>;
export type ProductUpdateInput = Record<string, unknown>;

export class ProductForbiddenError extends Error {
  constructor() {
    super("You do not have permission to modify this product");
    this.name = "ProductForbiddenError";
  }
}

const PRODUCT_WRITE_FIELDS = new Set([
  "name",
  "reference",
  "description",
  "priceInCents",
  "currency",
  "category",
  "image",
]);

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function normalizeRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${field} is required`);
  }
  return value.trim();
}

function normalizeOptionalString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new ValidationError(`${field} must be a string`);
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function parseNonNegativeInteger(value: unknown, field: string): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : NaN;

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }
  return parsed;
}

function validateCurrency(value: unknown): "BRL" {
  if (value !== undefined && value !== "BRL") {
    throw new ValidationError("Only BRL currency is supported");
  }
  return "BRL";
}

function validateCategory(value: unknown): ProductCategory {
  if (!Object.values(ProductCategory).includes(value as ProductCategory)) {
    throw new ValidationError("Invalid category");
  }
  return value as ProductCategory;
}

function rejectUnknownFields(input: Record<string, unknown>) {
  const unknown = Object.keys(input).find((field) => !PRODUCT_WRITE_FIELDS.has(field));
  if (unknown) throw new ValidationError(`Unsupported product field: ${unknown}`);
}

export class ProductService {
  constructor(private readonly repository: ProductRepositoryPort = productRepository) {}

  private toReadDto(product: ProductReadRecord, ratings: Map<string, number>): ProductReadDto {
    const onHandQuantity = product.inventory?.onHandQuantity ?? 0;
    const reservedQuantity = product.inventory?.reservedQuantity ?? 0;
    return {
      id: product.id,
      sellerId: product.sellerId,
      sellerName: product.seller.storeName,
      name: product.name,
      reference: product.reference,
      description: product.description,
      priceInCents: product.priceInCents,
      currency: "BRL",
      category: product.category,
      image: product.image,
      inventory: { onHandQuantity, reservedQuantity, availableQuantity: onHandQuantity - reservedQuantity },
      isAvailable: onHandQuantity - reservedQuantity > 0,
      averageRating: ratings.get(product.id) ?? null,
    };
  }

  private async readCollection(filters: ProductReadFilters, pagination: PaginationInput): Promise<ProductCollectionDto> {
    const total = await this.repository.count(filters);
    const products = await this.repository.findMany(filters, (pagination.page - 1) * pagination.limit, pagination.limit);
    const ratings = await this.repository.averageRatings(products.map((product) => product.id));
    return {
      data: products.map((product) => this.toReadDto(product, ratings)),
      pagination: { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) },
    };
  }

  async listProducts(filters: ProductReadFilters = {}, pagination: PaginationInput = { page: DEFAULT_PAGE, limit: DEFAULT_LIMIT }) {
    return this.readCollection(filters, pagination);
  }

  async getProductReadById(productId: string): Promise<ProductReadDto> {
    const product = await this.repository.findById(productId);
    if (!product) throw new ObjectNotFoundError("product");
    return this.toReadDto(product, await this.repository.averageRatings([product.id]));
  }

  async getProductsReadByIds(productIds: string[], pagination: PaginationInput) {
    if (!productIds.length) throw new ValidationError("No product id was informed.");
    return this.readCollection({ ids: productIds }, pagination);
  }

  async searchProductsRead(searchQuery: string, pagination: PaginationInput) {
    const search = searchQuery.trim();
    if (!search) throw new ValidationError("Search query cannot be empty");
    return this.readCollection({ search }, pagination);
  }

  async getProductsReadByCategory(category: ProductReadFilters["category"], pagination: PaginationInput) {
    if (!category) throw new ValidationError("Invalid category");
    return this.readCollection({ category }, pagination);
  }

  async getProductsReadBySeller(sellerId: string, pagination: PaginationInput) {
    return this.readCollection({ sellerId }, pagination);
  }

  private async assertCanManage(product: ProductAuthorizationRecord, actor: ProductActor) {
    if (actor.role === "ADMIN") return product;
    if (actor.role !== "SELLER") throw new ProductForbiddenError();
    const seller = await this.repository.findActiveSellerByUserId(actor.id);
    if (!seller || seller.id !== product.sellerId) throw new ProductForbiddenError();
    return product;
  }

  async createProduct(actor: ProductActor, input: ProductCreateInput): Promise<ProductReadDto> {
    rejectUnknownFields(input);
    const seller = actor.role === "SELLER" ? await this.repository.findActiveSellerByUserId(actor.id) : null;
    if (actor.role !== "SELLER" || !seller) throw new ProductForbiddenError();
    const data: ProductCreateData = {
      sellerId: seller.id,
      name: normalizeRequiredString(input.name, "name"),
      reference: normalizeOptionalString(input.reference, "reference"),
      description: normalizeOptionalString(input.description, "description"),
      priceInCents: parseNonNegativeInteger(input.priceInCents, "priceInCents"),
      currency: validateCurrency(input.currency),
      category: validateCategory(input.category),
      image: normalizeOptionalString(input.image, "image"),
    };
    try {
      const created = await this.repository.createWithInventory(data);
      return this.getProductReadById(created.id);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Product reference already exists for this seller");
      throw error;
    }
  }

  async updateProduct(productId: string, actor: ProductActor, input: ProductUpdateInput): Promise<ProductReadDto> {
    rejectUnknownFields(input);
    if (Object.keys(input).length === 0) throw new ValidationError("No fields to update");
    const product = await this.repository.findForAuthorization(productId);
    if (!product) throw new ObjectNotFoundError("Product");
    await this.assertCanManage(product, actor);
    if (!product.isActive) throw new ObjectNotFoundError("Product");
    const data: ProductUpdateData = {};
    if ("name" in input) data.name = normalizeRequiredString(input.name, "name");
    if ("reference" in input) data.reference = normalizeOptionalString(input.reference, "reference");
    if ("description" in input) data.description = normalizeOptionalString(input.description, "description");
    if ("priceInCents" in input) data.priceInCents = parseNonNegativeInteger(input.priceInCents, "priceInCents");
    if ("currency" in input) data.currency = validateCurrency(input.currency);
    if ("category" in input) data.category = validateCategory(input.category);
    if ("image" in input) data.image = normalizeOptionalString(input.image, "image");
    try {
      await this.repository.updateProduct(productId, data);
      return this.getProductReadById(productId);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Product reference already exists for this seller");
      throw error;
    }
  }

  async deactivateProduct(productId: string, actor: ProductActor): Promise<void> {
    const product = await this.repository.findForAuthorization(productId);
    if (!product) throw new ObjectNotFoundError("Product");
    await this.assertCanManage(product, actor);
    if (!product.isActive) return;
    await this.repository.deactivateProduct(productId, new Date());
  }
}
