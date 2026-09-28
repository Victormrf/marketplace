"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";
import { formatCurrency } from "@/lib/utils";
import { createRefund, getRefund, listRefunds } from "@/services/refunds";
import type { PaymentAttemptDto } from "@/types/payments";
import type { RefundCollectionDto, RefundDto } from "@/types/refunds";

const PAGE_SIZE = 5;

function refundErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return (
      "Não foi possível confirmar o resultado. " +
      "Atualize os refunds antes de tentar novamente."
    );
  }

  if (error.status === 400) return `Dados inválidos: ${error.message}`;
  if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
  if (error.status === 403) return "Você não tem permissão para este refund.";
  if (error.status === 404) return "Tentativa ou refund não encontrado.";
  if (error.status === 409) return `Conflito no refund: ${error.message}`;
  return error.message || "Não foi possível processar o refund.";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

type PaymentAttemptRefundsProps = {
  attempt: PaymentAttemptDto;
};

export function PaymentAttemptRefunds({ attempt }: PaymentAttemptRefundsProps) {
  const [collection, setCollection] =
    useState<RefundCollectionDto | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingRefundId, setRefreshingRefundId] = useState<string | null>(
    null,
  );
  const [amountInCents, setAmountInCents] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPage = useCallback(
    async (requestedPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listRefunds(
          attempt.id,
          requestedPage,
          PAGE_SIZE,
        );
        setCollection(result);
        setPage(requestedPage);
      } catch (requestError) {
        setError(refundErrorMessage(requestError));
      } finally {
        setLoading(false);
      }
    },
    [attempt.id],
  );

  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  const submitRefund = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number(amountInCents);
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setError("Informe um valor inteiro positivo em centavos.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createRefund(attempt.id, {
        amountInCents: parsedAmount,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setCollection((current) => ({
        data: [
          created,
          ...(current?.data.filter((refund) => refund.id !== created.id) ?? []),
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
      setPage(1);
      setAmountInCents("");
      setReason("");
      setNotice(`Solicitação recebida. Status atual: ${created.status}.`);
      await loadPage(1);
    } catch (requestError) {
      setError(refundErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const refreshRefund = async (refundId: string) => {
    setRefreshingRefundId(refundId);
    setError(null);
    try {
      const updated: RefundDto = await getRefund(refundId);
      setCollection((current) =>
        current
          ? {
              ...current,
              data: current.data.map((refund) =>
                refund.id === updated.id ? updated : refund,
              ),
            }
          : current,
      );
    } catch (requestError) {
      setError(refundErrorMessage(requestError));
    } finally {
      setRefreshingRefundId(null);
    }
  };

  return (
    <section className="mt-4 space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">Refunds desta tentativa</h4>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void loadPage(page)}
          disabled={loading}
        >
          {loading ? "Atualizando…" : "Atualizar refunds"}
        </Button>
      </div>

      {error && (
        <p
          className="rounded border border-destructive p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm" role="status">
          {notice}
        </p>
      )}

      {loading && !collection ? (
        <p role="status">Carregando refunds…</p>
      ) : collection?.data.length ? (
        <div className="space-y-2">
          {collection.data.map((refund) => (
            <article
              key={refund.id}
              className="space-y-1 rounded border p-3 text-sm"
            >
              <p className="font-medium">
                {refund.status} · {formatCurrency(refund.amountInCents / 100)}{" "}
                {refund.currency}
              </p>
              <p>Motivo: {refund.reason ?? "Não informado"}</p>
              <p>Criado: {formatDate(refund.createdAt)}</p>
              <p>Concluído: {formatDate(refund.completedAt)}</p>
              <p>Falhou: {formatDate(refund.failedAt)}</p>
              {refund.providerReference && (
                <p>Referência do provedor: {refund.providerReference}</p>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refreshRefund(refund.id)}
                disabled={refreshingRefundId === refund.id}
              >
                {refreshingRefundId === refund.id
                  ? "Consultando…"
                  : "Consultar refund"}
              </Button>
            </article>
          ))}
        </div>
      ) : (
        !loading && <p className="text-sm">Nenhum refund solicitado.</p>
      )}

      {collection && collection.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadPage(page - 1)}
            disabled={page <= 1 || loading}
          >
            Anterior
          </Button>
          <span className="text-xs">
            Página {page} de {collection.pagination.totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadPage(page + 1)}
            disabled={page >= collection.pagination.totalPages || loading}
          >
            Próxima
          </Button>
        </div>
      )}

      {attempt.status === "CAPTURED" && (
        <form className="grid gap-3 rounded border p-3" onSubmit={submitRefund}>
          <h5 className="font-medium">Solicitar refund parcial ou integral</h5>
          <label className="grid gap-1 text-sm">
            Valor em centavos
            <input
              className="h-10 rounded-md border bg-background px-3"
              type="number"
              min="1"
              step="1"
              required
              value={amountInCents}
              onChange={(event) => setAmountInCents(event.target.value)}
              disabled={submitting}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Motivo (opcional)
            <textarea
              className="min-h-20 rounded-md border bg-background p-3"
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={submitting}
            />
          </label>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enviando solicitação…" : "Solicitar refund"}
          </Button>
        </form>
      )}
    </section>
  );
}
