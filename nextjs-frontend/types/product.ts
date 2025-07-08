import { Seller } from "./seller";

export type Product = {
  id: string;
  name: string;
  price: number;
  image?: string;
  seller?: Seller;
  stock: number;
  description?: string;
  category?: string;
  averageRating?: number;
  createdAt?: string;
  totalSold?: number;
};
