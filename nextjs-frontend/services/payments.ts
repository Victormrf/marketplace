import { browserRequest } from "@/lib/http";
import type {
  CreatePaymentAttemptInput,
  PaymentAttemptCollectionDto,
  PaymentAttemptDto,
  PaymentAttemptStatusV2,
} from "@/types/payments";

export function createPaymentAttempt(
  orderId: string,
  input: CreatePaymentAttemptInput,
) {
  return browserRequest<PaymentAttemptDto>(
    `/api/orders/${encodeURIComponent(orderId)}/payment-attempts`,
    {
      method: "POST",
      json: input,
    },
  );
}

export function listPaymentAttempts(
  orderId: string,
  page = 1,
  limit = 10,
  status?: PaymentAttemptStatusV2,
) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status) query.set("status", status);

  return browserRequest<PaymentAttemptCollectionDto>(
    `/api/orders/${encodeURIComponent(orderId)}/payment-attempts?${query}`,
  );
}

export function getPaymentAttempt(paymentAttemptId: string) {
  return browserRequest<PaymentAttemptDto>(
    `/api/payment-attempts/${encodeURIComponent(paymentAttemptId)}`,
  );
}
