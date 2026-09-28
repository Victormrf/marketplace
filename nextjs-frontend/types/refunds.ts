export type RefundStatusV2 =
  | "REQUESTED"
  | "PROCESSING"
  | "COMPLETED"
  | "DECLINED"
  | "FAILED";

export type RefundDto = {
  id: string;
  paymentAttemptId: string;
  amountInCents: number;
  currency: string;
  reason: string | null;
  status: RefundStatusV2;
  providerReference: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  failedAt: string | null;
};

export type RefundCollectionDto = {
  data: RefundDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CreateRefundInput = {
  amountInCents: number;
  reason?: string;
};

export type RefundReadFilters = {
  status?: RefundStatusV2;
  createdFrom?: string;
  createdTo?: string;
};
