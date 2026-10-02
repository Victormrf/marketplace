export type ProductReadDto = {
  id: string;
  sellerId: string;
  sellerName: string;
  name: string;
  reference: string | null;
  description: string | null;
  priceInCents: number;
  currency: "BRL";
  category: string;
  image: string | null;
  inventory: {
    onHandQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
  };
  isAvailable: boolean;
  averageRating: number | null;
};

export type ProductCollectionDto = {
  data: ProductReadDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
