export type CartItemDto = {
  id: string; productId: string; quantity: number; name: string; priceInCents: number; currency: "BRL"; image: string | null;
  availableQuantity: number; hasSufficientStock: boolean; isAvailable: boolean; lineTotalInCents: number;
};
export type CartDto = { id: string; status: "ACTIVE"; items: CartItemDto[]; totalInCents: number };
