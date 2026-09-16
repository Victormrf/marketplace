import type { ProductCategory } from "@prisma/client";

export type ProductActor = { id: string; role?: string };
export type ProductAuthorizationRecord = { id: string; sellerId: string; isActive: boolean };
export type ProductCreateInput = Record<string, unknown>;
export type ProductUpdateInput = Record<string, unknown>;
export type ProductReadDto = {
  id: string; sellerId: string; sellerName: string; name: string; reference: string | null; description: string | null;
  priceInCents: number; currency: "BRL"; category: ProductCategory; image: string | null;
  inventory: { onHandQuantity: number; reservedQuantity: number; availableQuantity: number };
  isAvailable: boolean; averageRating: number | null;
};
export type ProductReadFilters = { search?: string; category?: ProductCategory; sellerId?: string; inStock?: boolean; ids?: string[] };
export type ProductPagination = { page: number; limit: number; total: number; totalPages: number };
export type ProductCollectionDto = { data: ProductReadDto[]; pagination: ProductPagination };
