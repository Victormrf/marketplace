import { Product } from "./product";

export type CartItem = {
  id?: string;
  userdId?: string;
  productId: string;
  quantity: number;
  createdAt?: string;
  product?: Product;
};
