import type { Currency, PaymentAttemptStatus, PaymentMethod } from "@prisma/client";

export type PaymentAttemptDto = {
  id: string;
  orderId: string;
  provider: string;
  providerReference: string | null;
  method: PaymentMethod;
  status: PaymentAttemptStatus;
  amountInCents: number;
  currency: Currency;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  authorizedAt: Date | null;
  capturedAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
};

export type PaymentAttemptCollectionDto = {
  data: PaymentAttemptDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type CreatePaymentAttemptInput = {
  method: PaymentMethod;
};

export type PaymentAttemptReadFilters = {
  status?: PaymentAttemptStatus;
  method?: PaymentMethod;
  createdFrom?: Date;
  createdTo?: Date;
};

export type PaymentFailureInput = { failureCode?: string; failureMessage?: string };
