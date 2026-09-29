"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";
import {
  createDelivery,
  getDeliveryForSellerOrder,
  getDeliveryHistory,
  updateDeliveryStatus,
  updateDeliveryTracking,
} from "@/services/deliveries";
import type {
  DeliveryDto,
  DeliveryStatusHistoryDto,
  DeliveryStatusV2,
} from "@/types/delivery";

type Props = {
  sellerOrderId: string;
};

const nextStatuses: Record<DeliveryStatusV2, DeliveryStatusV2[]> = {
  SEPARATED: ["PROCESSING", "FAILED"],
  PROCESSING: ["SHIPPED", "FAILED"],
  SHIPPED: ["COLLECTED", "FAILED"],
  COLLECTED: ["ARRIVED_AT_CENTER", "FAILED"],
  ARRIVED_AT_CENTER: ["DELIVERED", "FAILED"],
  DELIVERED: ["RETURNED"],
  FAILED: ["RETURNED"],
  RETURNED: [],
};

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 400) return "Os dados informados são inválidos (400).";
    if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
    if (error.status === 403) return "Somente o seller proprietário pode alterar esta entrega.";
    if (error.status === 404) return "Entrega ou SellerOrder não encontrado (404).";
    if (error.status === 409) {
      return "Conflito (409): o estado atual não permite esta operação. Os dados foram atualizados.";
    }
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

function asIsoDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Informe uma data de previsão válida.");
  }
  return parsed.toISOString();
}

function toLocalDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 16);
}

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

export function SellerOrderDeliveryManager({ sellerOrderId }: Props) {
  const [delivery, setDelivery] = useState<DeliveryDto | null>(null);
  const [history, setHistory] = useState<DeliveryStatusHistoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [carrier, setCarrier] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [originalEstimatedDelivery, setOriginalEstimatedDelivery] = useState("");
  const [reason, setReason] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHistoryError(null);
    try {
      const current = await getDeliveryForSellerOrder(sellerOrderId);
      setDelivery(current);
      setTrackingCode(current.trackingCode ?? "");
      setCarrier(current.carrier ?? "");
      const localEstimatedDelivery = toLocalDateTimeInput(
        current.estimatedDelivery,
      );
      setEstimatedDelivery(localEstimatedDelivery);
      setOriginalEstimatedDelivery(localEstimatedDelivery);
      try {
        setHistory(await getDeliveryHistory(current.id));
      } catch (requestError) {
        setHistoryError(errorMessage(requestError));
      }
    } catch (requestError) {
      setDelivery(null);
      setHistory([]);
      if (!(requestError instanceof ApiError && requestError.status === 404)) {
        setError(errorMessage(requestError));
      }
    } finally {
      setLoading(false);
    }
  }, [sellerOrderId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function create() {
    if (mutating) return;
    setMutating(true);
    setError(null);
    try {
      const input: { trackingCode?: string; carrier?: string; estimatedDelivery?: string } = {};
      if (trackingCode.trim()) input.trackingCode = trackingCode.trim();
      if (carrier.trim()) input.carrier = carrier.trim();
      if (estimatedDelivery) {
        input.estimatedDelivery = asIsoDate(estimatedDelivery);
      }
      const created = await createDelivery(sellerOrderId, input);
      setDelivery(created);
      await reload();
    } catch (requestError) {
      const message = errorMessage(requestError);
      if (requestError instanceof ApiError && requestError.status === 409) {
        await reload();
      }
      setError(message);
    } finally {
      setMutating(false);
    }
  }

  async function saveTracking() {
    if (!delivery || mutating) return;
    setMutating(true);
    setError(null);
    try {
      const input: {
        trackingCode?: string;
        carrier?: string;
        estimatedDelivery?: string | null;
      } = {};
      if (trackingCode.trim()) input.trackingCode = trackingCode.trim();
      if (carrier.trim()) input.carrier = carrier.trim();
      if (estimatedDelivery !== originalEstimatedDelivery) {
        input.estimatedDelivery = estimatedDelivery
          ? asIsoDate(estimatedDelivery)
          : null;
      }
      if (Object.keys(input).length === 0) {
        throw new Error("Informe ao menos um campo de rastreio para atualizar.");
      }
      await updateDeliveryTracking(delivery.id, input);
      await reload();
    } catch (requestError) {
      const message = errorMessage(requestError);
      if (requestError instanceof ApiError && requestError.status === 409) {
        await reload();
      }
      setError(message);
    } finally {
      setMutating(false);
    }
  }

  async function changeStatus(status: DeliveryStatusV2) {
    if (!delivery || mutating) return;
    setMutating(true);
    setError(null);
    try {
      await updateDeliveryStatus(delivery.id, {
        status,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setReason("");
      await reload();
    } catch (requestError) {
      const message = errorMessage(requestError);
      if (requestError instanceof ApiError && requestError.status === 409) {
        await reload();
      }
      setError(message);
    } finally {
      setMutating(false);
    }
  }

  const canEditTracking = delivery !== null && !["DELIVERED", "RETURNED", "FAILED"].includes(delivery.status);

  return (
    <section className="space-y-4 rounded border p-5" aria-label="Gestão da entrega">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Entrega e rastreio</h2>
        <Button type="button" variant="outline" onClick={() => void reload()} disabled={loading || mutating}>
          {loading ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded border border-destructive p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      {loading && !delivery ? <p role="status">Consultando entrega…</p> : null}
      {!loading && !delivery && !error ? (
        <div className="space-y-3">
          <p>Este SellerOrder ainda não possui entrega. A criação depende do estado atual do SellerOrder.</p>
          <TrackingFields
            trackingCode={trackingCode}
            carrier={carrier}
            estimatedDelivery={estimatedDelivery}
            setTrackingCode={setTrackingCode}
            setCarrier={setCarrier}
            setEstimatedDelivery={setEstimatedDelivery}
            disabled={mutating}
          />
          <Button type="button" onClick={() => void create()} disabled={mutating}>
            {mutating ? "Criando…" : "Criar entrega"}
          </Button>
        </div>
      ) : null}

      {delivery ? (
        <>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="font-medium">Status</dt><dd>{delivery.status}</dd></div>
            <div><dt className="font-medium">Transportadora</dt><dd>{delivery.carrier ?? "—"}</dd></div>
            <div>
              <dt className="font-medium">Código de rastreio</dt>
              <dd>{delivery.trackingCode ?? "—"}</dd>
            </div>
            <div><dt className="font-medium">Previsão</dt><dd>{displayDate(delivery.estimatedDelivery)}</dd></div>
            <div><dt className="font-medium">Entregue em</dt><dd>{displayDate(delivery.deliveredAt)}</dd></div>
          </dl>

          {canEditTracking ? (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium">Atualizar rastreio</h3>
              <TrackingFields
                trackingCode={trackingCode}
                carrier={carrier}
                estimatedDelivery={estimatedDelivery}
                setTrackingCode={setTrackingCode}
                setCarrier={setCarrier}
                setEstimatedDelivery={setEstimatedDelivery}
                disabled={mutating}
              />
              {estimatedDelivery ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEstimatedDelivery("")}
                  disabled={mutating}
                >
                  Remover previsão
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => void saveTracking()} disabled={mutating}>
                {mutating ? "Salvando…" : "Salvar rastreio"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Rastreio bloqueado para entregas em estado {delivery.status}.
            </p>
          )}

          <div className="space-y-3 border-t pt-4">
            <h3 className="font-medium">Transições disponíveis</h3>
            {nextStatuses[delivery.status].length ? (
              <>
                <label className="grid gap-1 text-sm">
                  Motivo (opcional)
                  <input
                    className="h-10 rounded-md border bg-background px-3"
                    maxLength={255}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    disabled={mutating}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses[delivery.status].map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant="outline"
                      onClick={() => void changeStatus(status)}
                      disabled={mutating}
                    >
                      {mutating ? "Atualizando…" : `Alterar para ${status}`}
                    </Button>
                  ))}
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">Estado final: não há novas transições.</p>}
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium">Histórico da entrega</h3>
            {historyError ? <p role="alert" className="mt-2 text-sm text-destructive">{historyError}</p> : null}
            {history.length ? (
              <ol className="mt-2 space-y-1 text-sm">
                {history.map((entry) => (
                  <li key={entry.id}>
                    {displayDate(entry.changedAt)} · {entry.fromStatus ?? "—"} → {entry.toStatus}
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

type TrackingFieldsProps = {
  trackingCode: string;
  carrier: string;
  estimatedDelivery: string;
  setTrackingCode: (value: string) => void;
  setCarrier: (value: string) => void;
  setEstimatedDelivery: (value: string) => void;
  disabled: boolean;
};

function TrackingFields({
  trackingCode,
  carrier,
  estimatedDelivery,
  setTrackingCode,
  setCarrier,
  setEstimatedDelivery,
  disabled,
}: TrackingFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="grid gap-1 text-sm">
        Código de rastreio
        <input
          className="h-10 rounded-md border bg-background px-3"
          maxLength={255}
          value={trackingCode}
          onChange={(event) => setTrackingCode(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Transportadora
        <input
          className="h-10 rounded-md border bg-background px-3"
          maxLength={255}
          value={carrier}
          onChange={(event) => setCarrier(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Previsão de entrega
        <input
          className="h-10 rounded-md border bg-background px-3"
          type="datetime-local"
          value={estimatedDelivery}
          onChange={(event) => setEstimatedDelivery(event.target.value)}
          disabled={disabled}
        />
      </label>
    </div>
  );
}
