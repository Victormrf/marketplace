import { RefundStatus, UserRole } from "@prisma/client";
import { customerRepository } from "../repositories/customerRepository";
import {
  RefundRepository,
  type RefundRecord,
} from "../repositories/refundRepository";
import {
  DevRefundProvider,
  RefundProviderDeclinedError,
  RefundProviderDefinitiveError,
  type RefundProvider,
} from "../providers/refundProvider";
import type { AuthenticatedUserDto } from "../types/auth";
import type {
  CreateRefundInput,
  RefundCollectionDto,
  RefundDto,
  RefundReadFilters,
} from "../types/refund";
import {
  ConflictError,
  ForbiddenError,
  ObjectNotFoundError,
  ValidationError,
} from "../utils/customErrors";

function toDto(record: RefundRecord): RefundDto {
  return {
    id: record.id,
    paymentAttemptId: record.paymentAttemptId,
    amountInCents: record.amountInCents,
    currency: record.currency,
    reason: record.reason,
    status: record.status,
    providerReference: record.providerReference,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
    failedAt: record.failedAt,
  };
}

function normalizeReason(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError("reason must be a string");
  }

  const result = value.trim();

  if (result.length > 500) {
    throw new ValidationError("reason is too long");
  }

  return result || null;
}

export class RefundService {
  constructor(
    private readonly repository = new RefundRepository(),
    private readonly provider: RefundProvider = new DevRefundProvider(),
  ) {}

  private async customerId(userId: string): Promise<string> {
    const profile = await customerRepository.findByUserId(userId);

    if (!profile) {
      throw new ForbiddenError("Only customers can access refunds");
    }

    return profile.id;
  }

  async requestRefund(
    user: AuthenticatedUserDto,
    paymentAttemptId: string,
    input: CreateRefundInput,
  ): Promise<RefundDto> {
    let customerId: string | null = null;

    if (user.role === UserRole.CUSTOMER) {
      customerId = await this.customerId(user.id);
    } else if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenError();
    }

    if (!Number.isInteger(input.amountInCents) || input.amountInCents <= 0) {
      throw new ValidationError("amountInCents must be a positive integer");
    }

    const requested = await this.repository.createRequested(
      customerId,
      paymentAttemptId,
      {
        amountInCents: input.amountInCents,
        reason: normalizeReason(input.reason),
      },
    );

    const processing = await this.repository.transition(
      requested.id,
      RefundStatus.PROCESSING,
    );

    if (!processing) {
      throw new ObjectNotFoundError("Refund");
    }
    return this.provisionRefund(processing.id);
  }

  async provisionRefund(id: string): Promise<RefundDto> {
    const current = await this.repository.findForProvisioning(id);

    if (!current) throw new ObjectNotFoundError("Refund");

    if (current.status !== RefundStatus.PROCESSING)
      throw new ConflictError("Only PROCESSING refunds can be provisioned");

    if (!current.paymentAttempt.providerReference)
      throw new ConflictError("Payment attempt has no provider reference");
    let external;

    try {
      external = await this.provider.createRefund({
        refundId: current.id,
        paymentAttemptId: current.paymentAttemptId,
        paymentProviderReference: current.paymentAttempt.providerReference,
        amountInCents: current.amountInCents,
        currency: current.currency,
      });
    } catch (error) {
      if (error instanceof RefundProviderDeclinedError) {
        await this.repository
          .transition(current.id, RefundStatus.DECLINED)
          .catch(() => undefined);
      } else if (error instanceof RefundProviderDefinitiveError) {
        await this.repository
          .transition(current.id, RefundStatus.FAILED)
          .catch(() => undefined);
      }
      throw error;
    }
    const withReference = await this.repository.setProviderReference(
      current.id,
      external.providerReference,
    );
    const completed = await this.repository.transition(
      withReference.id,
      RefundStatus.COMPLETED,
    );
    if (!completed) throw new ObjectNotFoundError("Refund");
    return toDto(completed);
  }
  async list(
    user: AuthenticatedUserDto,
    paymentAttemptId: string,
    filters: RefundReadFilters,
    page: number,
    limit: number,
  ): Promise<RefundCollectionDto> {
    const customerId =
      user.role === UserRole.CUSTOMER
        ? await this.customerId(user.id)
        : undefined;
    if (user.role !== UserRole.CUSTOMER && user.role !== UserRole.ADMIN)
      throw new ForbiddenError();
    const [total, records] = await Promise.all([
      this.repository.count(paymentAttemptId, filters, customerId),
      this.repository.findMany(
        paymentAttemptId,
        filters,
        (page - 1) * limit,
        limit,
        customerId,
      ),
    ]);
    return {
      data: records.map(toDto),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
  async get(user: AuthenticatedUserDto, id: string): Promise<RefundDto> {
    if (user.role === UserRole.SELLER) throw new ForbiddenError();
    const record =
      user.role === UserRole.ADMIN
        ? await this.repository.findById(id)
        : await this.repository.findByCustomerAndId(
            await this.customerId(user.id),
            id,
          );
    if (!record) throw new ObjectNotFoundError("Refund");
    return toDto(record);
  }
}
