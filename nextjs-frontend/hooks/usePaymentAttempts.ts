"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/http";
import {
  createPaymentAttempt,
  getPaymentAttempt,
  listPaymentAttempts,
} from "@/services/payments";
import type {
  CreatePaymentAttemptInput,
  PaymentAttemptCollectionDto,
  PaymentAttemptDto,
  PaymentAttemptStatusV2,
} from "@/types/payments";

const PAGE_SIZE = 10;
const BLOCKING_STATUSES: PaymentAttemptStatusV2[] = [
  "CREATED",
  "PROCESSING",
  "AUTHORIZED",
  "CAPTURED",
];

function paymentErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Sua sessão expirou. Entre novamente para consultar pagamentos.";
    }
    if (error.status === 403) {
      return (
        "Você não tem permissão para consultar ou iniciar pagamentos deste pedido."
      );
    }
    if (error.status === 404) {
      return "Pedido ou tentativa de pagamento não encontrado.";
    }
    if (error.status === 409) {
      return (
        "O pedido não aceita uma nova tentativa ou já possui uma tentativa ativa. " +
        "Atualize a lista para consultar o estado atual."
      );
    }
    if (error.status >= 500) {
      return (
        "Não foi possível confirmar a resposta do servidor. " +
        "Atualize as tentativas antes de repetir; nenhum pagamento será mostrado como concluído sem confirmação."
      );
    }
    return error.message;
  }

  return (
    "Não foi possível confirmar a resposta do serviço. " +
    "Nenhum pagamento foi marcado como concluído; atualize as tentativas antes de repetir."
  );
}

export function usePaymentAttempts(orderId: string, enabled: boolean) {
  const [collection, setCollection] =
    useState<PaymentAttemptCollectionDto | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canStartAttempt, setCanStartAttempt] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (requestedPage: number) => {
      if (!enabled) return;

      setLoading(true);
      setError(null);
      try {
        const result = await listPaymentAttempts(
          orderId,
          requestedPage,
          PAGE_SIZE,
        );
        setCollection(result);
        setPage(requestedPage);
      } catch (requestError) {
        setError(paymentErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    },
    [enabled, orderId],
  );

  const refreshEligibility = useCallback(async () => {
    if (!enabled) {
      setCanStartAttempt(false);
      setEligibilityLoading(false);
      setEligibilityError(null);
      return;
    }

    setEligibilityLoading(true);
    setEligibilityError(null);
    setCanStartAttempt(false);
    try {
      const blockingCollections = await Promise.all(
        BLOCKING_STATUSES.map((status) =>
          listPaymentAttempts(orderId, 1, 1, status),
        ),
      );
      setCanStartAttempt(
        blockingCollections.every((result) => result.pagination.total === 0),
      );
    } catch (requestError) {
      setCanStartAttempt(false);
      setEligibilityError(paymentErrorMessage(requestError));
    } finally {
      setEligibilityLoading(false);
    }
  }, [enabled, orderId]);

  useEffect(() => {
    void loadPage(1);
    void refreshEligibility();
  }, [loadPage, refreshEligibility]);

  const startAttempt = useCallback(
    async (input: CreatePaymentAttemptInput) => {
      setSubmitting(true);
      setError(null);
      try {
        const created = await createPaymentAttempt(orderId, input);
        setCanStartAttempt(false);
        setCollection((current) => ({
          data: [
            created,
            ...(current?.data.filter((attempt) => attempt.id !== created.id) ??
              []),
          ].slice(0, PAGE_SIZE),
          pagination: {
            page: 1,
            limit: PAGE_SIZE,
            total: (current?.pagination.total ?? 0) + 1,
            totalPages: Math.max(
              1,
              Math.ceil(((current?.pagination.total ?? 0) + 1) / PAGE_SIZE),
            ),
          },
        }));
        await Promise.all([loadPage(1), refreshEligibility()]);
      } catch (requestError) {
        await refreshEligibility();
        setError(paymentErrorMessage(requestError));
      } finally {
        setSubmitting(false);
      }
    },
    [loadPage, orderId, refreshEligibility],
  );

  const refreshAttempt = useCallback(
    async (paymentAttemptId: string) => {
      setError(null);
      try {
        const updated = await getPaymentAttempt(paymentAttemptId);
        setCollection((current) => {
          if (!current) return current;
          return {
            ...current,
            data: current.data.map((attempt) =>
              attempt.id === updated.id ? updated : attempt,
            ),
          };
        });
        await refreshEligibility();
      } catch (requestError) {
        setError(paymentErrorMessage(requestError));
      }
    },
    [refreshEligibility],
  );

  const changePage = useCallback(
    async (nextPage: number) => {
      await Promise.all([loadPage(nextPage), refreshEligibility()]);
    },
    [loadPage, refreshEligibility],
  );

  return {
    canStartAttempt,
    eligibilityError,
    eligibilityLoading,
    attempts: collection?.data ?? [],
    error,
    loading,
    page,
    pagination: collection?.pagination ?? null,
    refreshAttempt,
    reload: () => void Promise.all([loadPage(page), refreshEligibility()]),
    setPage: (nextPage: number) => void changePage(nextPage),
    startAttempt,
    submitting,
  };
}
