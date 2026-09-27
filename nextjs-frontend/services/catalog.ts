import { browserRequest } from "@/lib/http";
import type {
  ProductCollectionDto,
  ProductReadDto,
} from "@/types/product";

export type ProductCategory =
  | "OFFICE"
  | "SPORTS"
  | "BOOKS"
  | "BEAUTY"
  | "CLOTHING"
  | "TOYS"
  | "TV_PROJECTORS"
  | "SMARTPHONES_TABLETS"
  | "ELECTRONICS"
  | "PETS"
  | "FURNITURE";

export type ProductWriteInput = {
  name?: string;
  reference?: string | null;
  description?: string | null;
  priceInCents?: number;
  currency?: "BRL";
  category?: ProductCategory;
  image?: string | File | null;
};

function productFormData(input: ProductWriteInput): FormData {
  const form = new FormData();

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (value instanceof File) {
      form.set(key, value);
    } else if (value === null) {
      form.set(key, "");
    } else {
      form.set(key, String(value));
    }
  }

  return form;
}

export function listProducts(query: URLSearchParams = new URLSearchParams()) {
  const suffix = query.size ? `?${query.toString()}` : "";
  return browserRequest<ProductCollectionDto>(`/api/products${suffix}`);
}

export function getProduct(productId: string) {
  return browserRequest<ProductReadDto>(
    `/api/products/${encodeURIComponent(productId)}`,
  );
}

export function listSellerProducts(
  sellerId: string,
  query: URLSearchParams = new URLSearchParams(),
) {
  const params = new URLSearchParams(query);
  if (!params.has("page")) params.set("page", "1");
  if (!params.has("limit")) params.set("limit", "20");

  return browserRequest<ProductCollectionDto>(
    `/api/products/seller/${encodeURIComponent(sellerId)}?${params.toString()}`,
  );
}

export function createProduct(input: ProductWriteInput) {
  return browserRequest<ProductReadDto>("/api/products", {
    method: "POST",
    body: productFormData(input),
  });
}

export function updateProduct(
  productId: string,
  input: ProductWriteInput,
) {
  return browserRequest<ProductReadDto>(
    `/api/products/${encodeURIComponent(productId)}`,
    {
      method: "PUT",
      body: productFormData(input),
    },
  );
}
