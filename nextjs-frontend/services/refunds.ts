import { browserRequest } from "@/lib/http";
import type {
  CreateRefundInput,
  RefundCollectionDto,
  RefundDto,
  RefundReadFilters,
} from "@/types/refunds";

export function createRefund(
  paymentAttemptId: string,
  input: CreateRefundInput,
) {
  return browserRequest<RefundDto>(
    `/api/payment-attempts/${encodeURIComponent(paymentAttemptId)}/refunds`,
    {
      method: "POST",
      json: input,
    },
  );
}

export function listRefunds(
  paymentAttemptId: string,
  page = 1,
  limit = 5,
  filters: RefundReadFilters = {},
) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (filters.status) query.set("status", filters.status);
  if (filters.createdFrom) query.set("createdFrom", filters.createdFrom);
  if (filters.createdTo) query.set("createdTo", filters.createdTo);

  return browserRequest<RefundCollectionDto>(
    `/api/payment-attempts/${encodeURIComponent(paymentAttemptId)}/refunds?${query}`,
  );
}

export function getRefund(refundId: string) {
  return browserRequest<RefundDto>(
    `/api/refunds/${encodeURIComponent(refundId)}`,
  );
}
