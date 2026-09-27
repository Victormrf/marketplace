import { browserRequest } from "@/lib/http";
import type {
  AddCartItemInput,
  CartDto,
  UpdateCartItemInput,
} from "@/types/cart";

const CART_PATH = "/api/cart";

export function getCart() {
  return browserRequest<CartDto>(CART_PATH);
}

export function addCartItem(input: AddCartItemInput) {
  return browserRequest<CartDto>(`${CART_PATH}/items`, {
    method: "POST",
    json: input,
  });
}

export function updateCartItem(
  productId: string,
  input: UpdateCartItemInput,
) {
  return browserRequest<CartDto>(
    `${CART_PATH}/items/${encodeURIComponent(productId)}`,
    { method: "PUT", json: input },
  );
}

export function removeCartItem(productId: string) {
  return browserRequest<void>(
    `${CART_PATH}/items/${encodeURIComponent(productId)}`,
    { method: "DELETE" },
  );
}

export function clearCart() {
  return browserRequest<void>(`${CART_PATH}/items`, { method: "DELETE" });
}
