export type ReviewTarget = "product" | "seller";

export type ReviewDto = {
  id: string;
  productId: string | null;
  sellerId: string | null;
  rating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReviewInput = {
  rating: number;
  comment?: string | null;
};

export type ReviewUpdateInput = {
  rating?: number;
  comment?: string | null;
};

export type ReviewReadFilters = {
  rating?: number;
};

export type ReviewPagination = {
  page: number;
  limit: number;
};

export type ReviewReputationDto = {
  averageRating: number | null;
  totalReviews: number;
  distribution: {
    "1": number;
    "2": number;
    "3": number;
    "4": number;
    "5": number;
  };
};

export type ReviewCollectionDto = {
  data: ReviewDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  reputation: ReviewReputationDto;
};
