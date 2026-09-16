export type { ProductCollectionDto, ProductPagination, ProductReadDto, ProductReadFilters } from "./product";

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
