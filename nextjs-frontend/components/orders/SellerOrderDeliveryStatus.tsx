"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";
import {
  getDeliveryForSellerOrder,
  getDeliveryHistory,
} from "@/services/deliveries";
import type {
  DeliveryDto,
  DeliveryStatusHistoryDto,
} from "@/types/delivery";

type Props = {
  sellerOrderId: string;
};

function describeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
    if (error.status === 403) return "Você não tem permissão para consultar esta entrega.";
    if (error.status === 404) return "Entrega não encontrada para este SellerOrder.";
  }
  return error instanceof Error ? error.message : "Não foi possível consultar a entrega.";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

export function SellerOrderDeliveryStatus({ sellerOrderId }: Props) {
  const [delivery, setDelivery] = useState<DeliveryDto | null>(null);
  const [history, setHistory] = useState<DeliveryStatusHistoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHistoryError(null);
    try {
      const current = await getDeliveryForSellerOrder(sellerOrderId);
      setDelivery(current);
      try {
        setHistory(await getDeliveryHistory(current.id));
      } catch (requestError) {
        setHistoryError(describeError(requestError));
      }
    } catch (requestError) {
      setDelivery(null);
      setHistory([]);
      if (requestError instanceof ApiError && requestError.status === 404) {
        setError(null);
      } else {
        setError(describeError(requestError));
      }
    } finally {
      setLoading(false);
    }
  }, [sellerOrderId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <section className="space-y-3 rounded border p-5" aria-label="Entrega">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Entrega</h2>
        <Button type="button" variant="outline" onClick={() => void reload()} disabled={loading}>
          {loading ? "Atualizando…" : "Atualizar entrega"}
        </Button>
      </div>

      {loading && !delivery ? <p role="status">Carregando entrega…</p> : null}
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      {!loading && !error && !delivery ? (
        <p>Este SellerOrder ainda não possui uma entrega registrada.</p>
      ) : null}

      {delivery ? (
        <>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="font-medium">Status</dt><dd>{delivery.status}</dd></div>
            <div><dt className="font-medium">Transportadora</dt><dd>{delivery.carrier ?? "—"}</dd></div>
            <div><dt className="font-medium">Código de rastreio</dt><dd>{delivery.trackingCode ?? "—"}</dd></div>
            <div><dt className="font-medium">Previsão</dt><dd>{formatDate(delivery.estimatedDelivery)}</dd></div>
            <div><dt className="font-medium">Entregue em</dt><dd>{formatDate(delivery.deliveredAt)}</dd></div>
          </dl>
          <div className="border-t pt-3">
            <h3 className="font-medium">Histórico da entrega</h3>
            {historyError ? <p role="alert" className="mt-2 text-sm text-destructive">{historyError}</p> : null}
            {history.length ? (
              <ol className="mt-2 space-y-1 text-sm">
                {history.map((entry) => (
                  <li key={entry.id}>
                    {formatDate(entry.changedAt)} · {entry.fromStatus ?? "—"} → {entry.toStatus}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </li>
                ))}
              </ol>
            ) : !historyError ? <p className="mt-2 text-sm">Nenhum histórico disponível.</p> : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
