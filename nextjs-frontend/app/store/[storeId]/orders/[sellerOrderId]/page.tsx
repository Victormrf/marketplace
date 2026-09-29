"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SellerOrderDeliveryManager } from "@/components/orders/SellerOrderDeliveryManager";
import { useAuth } from "@/context/authContext";
import { ApiError } from "@/lib/http";
import { formatCurrency } from "@/lib/utils";
import { getMySellerOrder, transitionMySellerOrder } from "@/services/ordersV2";
import type { SellerOrderDetailV2, SellerOrderStatusV2 } from "@/types/ordersV2";

export default function SellerOrderDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const { storeId, sellerOrderId } = useParams<{
    storeId: string;
    sellerOrderId: string;
  }>();
  const [order, setOrder] = useState<SellerOrderDetailV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOrder(await getMySellerOrder(sellerOrderId));
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status === 404
          ? "SellerOrder não encontrado para esta loja."
          : requestError instanceof ApiError && requestError.status === 403
            ? "Esta conta não tem permissão para consultar este SellerOrder."
            : requestError instanceof Error
              ? requestError.message
              : "Não foi possível carregar o SellerOrder.",
      );
    } finally {
      setLoading(false);
    }
  }, [sellerOrderId]);

  useEffect(() => {
    if (!authLoading && user?.role === "SELLER") void refresh();
  }, [authLoading, refresh, user?.role]);

  async function transition(
    status: Extract<SellerOrderStatusV2, "CONFIRMED" | "PROCESSING">,
  ) {
    if (!order || mutating) return;
    setMutating(true);
    setError(null);
    try {
      setOrder(await transitionMySellerOrder(order.id, status));
    } catch (requestError) {
      const message =
        requestError instanceof ApiError && requestError.status === 409
          ? "A transição foi recusada (409): o estado atual ou o estado do pedido pai não permite essa operação."
          : requestError instanceof Error
            ? requestError.message
            : "Não foi possível alterar o status.";
      await refresh();
      setError(message);
    } finally {
      setMutating(false);
    }
  }

  if (authLoading) {
    return <main className="p-8" role="status">Carregando sessão…</main>;
  }
  if (!user) {
    return (
      <main className="p-8">
        <p role="alert">Entre como seller.</p>
        <Button asChild><Link href="/login">Entrar</Link></Button>
      </main>
    );
  }
  if (user.role !== "SELLER") {
    return <main className="p-8"><p role="alert">A área é exclusiva para sellers.</p></main>;
  }
  if (loading) {
    return <main className="p-8" role="status">Carregando SellerOrder…</main>;
  }
  if (!order) {
    return (
      <main className="space-y-4 p-8">
        <p role="alert">{error ?? "SellerOrder não encontrado."}</p>
        <Button asChild variant="outline">
          <Link href={`/store/${encodeURIComponent(storeId)}/orders`}>Voltar</Link>
        </Button>
      </main>
    );
  }

  const target =
    order.status === "PENDING"
      ? "CONFIRMED"
      : order.status === "CONFIRMED"
        ? "PROCESSING"
        : null;

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">SellerOrder {order.id}</h1>
          <p>{order.status} · {new Date(order.createdAt).toLocaleString("pt-BR")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/store/${encodeURIComponent(storeId)}/orders`}>
            Voltar aos pedidos
          </Link>
        </Button>
      </div>
      {error && (
        <p role="alert" className="rounded border border-destructive p-3 text-destructive">
          {error}
        </p>
      )}
      {target && (
        <Button disabled={mutating} onClick={() => void transition(target)}>
          {mutating ? "Atualizando…" : `Avançar para ${target}`}
        </Button>
      )}
      <section className="space-y-3 rounded border p-5">
        {order.items.map((item) => (
          <article
            key={item.id}
            className="flex justify-between gap-3 border-b pb-3"
          >
            <span>
              {item.productNameSnapshot} × {item.quantity}
              <small className="block text-muted-foreground">
                {item.sellerNameSnapshot}
                {item.productReferenceSnapshot ? ` · ${item.productReferenceSnapshot}` : ""}
              </small>
            </span>
            <span>{formatCurrency(item.lineTotalInCents / 100)}</span>
          </article>
        ))}
        <p className="text-right font-semibold">
          Total: {formatCurrency(order.totalInCents / 100)} {order.currency}
        </p>
      </section>
      <section className="rounded border p-5">
        <h2 className="font-semibold">Histórico</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {order.statusHistory.map((entry) => (
            <li key={entry.id}>
              {new Date(entry.createdAt).toLocaleString("pt-BR")} · {entry.fromStatus ?? "—"} → {entry.toStatus}
              {entry.reason ? ` · ${entry.reason}` : ""}
            </li>
          ))}
        </ol>
      </section>
      <SellerOrderDeliveryManager sellerOrderId={order.id} />
    </main>
  );
}
