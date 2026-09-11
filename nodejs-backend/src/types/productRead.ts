import { ProductCategory } from "@prisma/client";

export type ProductReadDto = {
  id: string;
  sellerId: string;
  sellerName: string;
  name: string;
  reference: string | null;
  description: string | null;
  priceInCents: number;
  currency: "BRL";
  category: ProductCategory;
  image: string | null;
  inventory: {
    onHandQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
  };
  averageRating: number | null;
};

export type ProductReadFilters = {
  search?: string;
  category?: ProductCategory;
  sellerId?: string;
  ids?: string[];
};

export type ProductPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ProductCollectionDto = {
  data: ProductReadDto[];
  pagination: ProductPagination;
};

export type PaginationInput = {
  page: number;
  limit: number;
};

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function parsePaginationValue(
  value: unknown,
  fallback: number,
  field: "page" | "limit"
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`Invalid ${field}`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ${field}`);
  }

  if (field === "limit" && parsed > MAX_LIMIT) {
    throw new Error(`Invalid ${field}`);
  }

  return parsed;
}
