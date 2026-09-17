import { createHash } from "crypto";
import type { Currency } from "@prisma/client";
export class RefundProviderDeclinedError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RefundProviderDeclinedError";
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause;
  }
}

export class RefundProviderDefinitiveError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RefundProviderDefinitiveError";
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause;
  }
}

export class RefundProviderUnknownResultError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RefundProviderUnknownResultError";
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause;
  }
}

export type RefundProviderInput = { refundId: string; paymentAttemptId: string; paymentProviderReference: string; amountInCents: number; currency: Currency };
export type RefundProviderResult = { provider: string; providerReference: string };
export interface RefundProvider { createRefund(input: RefundProviderInput): Promise<RefundProviderResult>; }
export type DevRefundProviderOutcome = "SUCCESS" | "DECLINED" | "DEFINITIVE_FAILURE" | "UNKNOWN_RESULT";
export class DevRefundProvider implements RefundProvider {
  constructor(private readonly outcome: DevRefundProviderOutcome = "SUCCESS") {}
  async createRefund(input: RefundProviderInput): Promise<RefundProviderResult> { if (this.outcome === "DECLINED") throw new RefundProviderDeclinedError("Refund was declined by the development provider"); if (this.outcome === "DEFINITIVE_FAILURE") throw new RefundProviderDefinitiveError("Refund failed definitively in the development provider"); if (this.outcome === "UNKNOWN_RESULT") throw new RefundProviderUnknownResultError("Refund provider result is unknown"); const digest = createHash("sha256").update(input.refundId).digest("hex").slice(0, 24); return { provider: "DEV_SIMULATOR", providerReference: `dev_refund_${digest}` }; }
}
