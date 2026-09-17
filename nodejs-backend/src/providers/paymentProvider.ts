import { createHash } from "crypto";
import type { PaymentMethod } from "@prisma/client";

export class PaymentProviderDefinitiveError extends Error {
  readonly failureCode: string;

  constructor(message: string, failureCode = "PROVIDER_DECLINED", cause?: unknown) {
    super(message);
    this.name = "PaymentProviderDefinitiveError";
    this.failureCode = failureCode;
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause;
  }
}
export class PaymentProviderUnknownResultError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PaymentProviderUnknownResultError";
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause;
  }
}

export type PaymentProviderAttemptInput = { paymentAttemptId: string; orderId: string; method: PaymentMethod; amountInCents: number };
export type PaymentProviderAttemptResult = { provider: string; providerReference: string };

export interface PaymentProvider {
  createAttempt(input: PaymentProviderAttemptInput): Promise<PaymentProviderAttemptResult>;
}

export type DevPaymentProviderOutcome = "SUCCESS" | "DEFINITIVE_FAILURE" | "UNKNOWN_RESULT";

export class DevPaymentProvider implements PaymentProvider {
  constructor(private readonly outcome: DevPaymentProviderOutcome = "SUCCESS") {}

  async createAttempt(input: PaymentProviderAttemptInput): Promise<PaymentProviderAttemptResult> {
    if (this.outcome === "DEFINITIVE_FAILURE") throw new PaymentProviderDefinitiveError("Payment was declined by the development provider");
    if (this.outcome === "UNKNOWN_RESULT") throw new PaymentProviderUnknownResultError("Payment provider result is unknown");
    const digest = createHash("sha256").update(input.paymentAttemptId).digest("hex").slice(0, 24);
    return { provider: "DEV_SIMULATOR", providerReference: `dev_${digest}` };
  }
}
