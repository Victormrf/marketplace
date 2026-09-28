export type PaymentMethodV2 =
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "PIX"
  | "PAYPAL";

export type PaymentAttemptStatusV2 =
  | "CREATED"
  | "PROCESSING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "CANCELLED";

export type PaymentAttemptDto = {
  id: string;
  orderId: string;
  provider: string;
  providerReference: string | null;
  method: PaymentMethodV2;
  status: PaymentAttemptStatusV2;
  amountInCents: number;
  currency: string;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
  authorizedAt: string | null;
  capturedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
};

export type PaymentAttemptCollectionDto = {
  data: PaymentAttemptDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CreatePaymentAttemptInput = {
  method: PaymentMethodV2;
};
