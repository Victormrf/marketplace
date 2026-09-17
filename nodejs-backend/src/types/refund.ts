import type { Currency, RefundStatus } from "@prisma/client";

export type RefundDto = { id: string; paymentAttemptId: string; amountInCents: number; currency: Currency; reason: string | null; status: RefundStatus; providerReference: string | null; createdAt: Date; updatedAt: Date; completedAt: Date | null; failedAt: Date | null };
export type RefundCollectionDto = { data: RefundDto[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
export type CreateRefundInput = { amountInCents: number; reason?: string | null };
export type RefundReadFilters = { status?: RefundStatus; createdFrom?: Date; createdTo?: Date };
