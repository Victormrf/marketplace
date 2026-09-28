"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/authContext";
import { ApiError } from "@/lib/http";
import { formatCurrency } from "@/lib/utils";
import { getMyOrder } from "@/services/ordersV2";
import type { OrderDetailV2 } from "@/types/ordersV2";

export default function OrderDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetailV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || user.role !== "CUSTOMER") return;
    let cancelled = false;
    setLoading(true);
    getMyOrder(params.orderId)
      .then((value) => { if (!cancelled) setOrder(value); })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof ApiError && requestError.status === 404
              ? "Pedido não encontrado."
              : requestError instanceof ApiError && requestError.status === 403
                ? "Você não tem permissão para consultar este pedido."
                : requestError instanceof Error
                  ? requestError.message
                  : "Não foi possível carregar o pedido.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, params.orderId, user]);

  if (authLoading) {
    return <main className="p-8" role="status">Carregando sessão…</main>;
  }
  if (!user) {
    return (
      <main className="space-y-3 p-8">
        <p role="alert">Entre para consultar este pedido.</p>
        <Button asChild>
          <Link href={`/login?returnTo=${encodeURIComponent(`/orders/${params.orderId}`)}`}>
            Entrar
          </Link>
        </Button>
      </main>
    );
  }
  if (user.role !== "CUSTOMER") {
    return <main className="p-8"><p role="alert">Esta página é exclusiva para customers.</p></main>;
  }
  if (loading) {
    return <main className="p-8" role="status">Carregando pedido…</main>;
  }
  if (error || !order) {
    return (
      <main className="space-y-4 p-8">
        <p role="alert">{error ?? "Pedido não encontrado."}</p>
        <Button asChild variant="outline">
          <Link href="/orders">Voltar aos pedidos</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Pedido {order.id}</h1>
          <p>{order.status} · {new Date(order.createdAt).toLocaleString("pt-BR")}</p>
        </div>
        <Button asChild variant="outline"><Link href="/orders">Meus pedidos</Link></Button>
      </div>
      <section className="rounded border p-5">
        <h2 className="mb-3 text-xl font-semibold">Endereço do pedido</h2>
        {order.address ? (
          <p>
            {order.address.recipientName}<br />
            {order.address.street}, {order.address.number}
            {order.address.complement ? `, ${order.address.complement}` : ""}<br />
            {order.address.neighborhood}, {order.address.city} - {order.address.state} · {order.address.postalCode}
          </p>
        ) : <p>Snapshot do endereço indisponível.</p>}
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">SellerOrders</h2>
        {order.sellerOrders.map((sellerOrder) => (
          <article key={sellerOrder.id} className="space-y-3 rounded border p-5">
            <h3 className="font-semibold">SellerOrder {sellerOrder.id} · {sellerOrder.status}</h3>
            {sellerOrder.items.map((item) => (
              <div key={item.id} className="flex flex-wrap justify-between gap-2 border-t pt-3">
                <span>
                  {item.productNameSnapshot} × {item.quantity}
                  <small className="block text-muted-foreground">
                    {item.sellerNameSnapshot}
                    {item.productReferenceSnapshot ? ` · ${item.productReferenceSnapshot}` : ""}
                  </small>
                </span>
                <span>{formatCurrency(item.lineTotalInCents / 100)}</span>
              </div>
            ))}
            <p className="text-right font-semibold">Total: {formatCurrency(sellerOrder.totalInCents / 100)}</p>
            <ol className="border-t pt-3 text-sm">
              {sellerOrder.statusHistory.map((history) => (
                <li key={history.id}>
                  {new Date(history.createdAt).toLocaleString("pt-BR")} · {history.fromStatus ?? "—"} → {history.toStatus}
                  {history.reason ? ` · ${history.reason}` : ""}
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>
      <section className="rounded border p-5">
        <h2 className="text-xl font-semibold">Histórico do pedido</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {order.statusHistory.map((history) => (
            <li key={history.id}>
              {new Date(history.createdAt).toLocaleString("pt-BR")} · {history.fromStatus ?? "—"} → {history.toStatus}
              {history.reason ? ` · ${history.reason}` : ""}
            </li>
          ))}
        </ol>
      </section>
      <p className="border-t pt-4 text-right text-xl font-bold">Total do pedido: {formatCurrency(order.totalInCents / 100)} {order.currency}</p>
    </main>
  );
}
