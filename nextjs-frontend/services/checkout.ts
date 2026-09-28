import { browserRequest } from "@/lib/http";
import type { CheckoutDto } from "@/types/checkout";

export function submitCheckout(addressId: string, idempotencyKey: string) {
  return browserRequest<CheckoutDto>("/api/checkout", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    json: { addressId },
  });
}
