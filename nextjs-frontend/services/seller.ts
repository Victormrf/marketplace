import { browserRequest } from "@/lib/http";
import type { Seller } from "@/types/seller";

export type SellerProfileInput = {
  storeName?: string;
  description?: string | null;
  logo?: string | null;
};

export async function getMySellerProfile(): Promise<Seller> {
  return browserRequest<Seller>("/api/sellers");
}

export async function createMySellerProfile(
  input: SellerProfileInput,
): Promise<Seller> {
  return browserRequest<Seller>("/api/sellers", {
    method: "POST",
    json: input,
  });
}

export async function updateMySellerProfile(
  input: SellerProfileInput,
): Promise<Seller> {
  return browserRequest<Seller>("/api/sellers", {
    method: "PUT",
    json: input,
  });
}
