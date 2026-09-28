"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/authContext";
import { ApiError } from "@/lib/http";
import { formatCurrency } from "@/lib/utils";
import { listMySellerOrders } from "@/services/ordersV2";
import type { Paged, SellerOrderSummaryV2 } from "@/types/ordersV2";

export default function SellerOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const { storeId } = useParams<{ storeId: string }>();
  const [orders, setOrders] = useState<Paged<SellerOrderSummaryV2> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await listMySellerOrders({ page, limit: 20 }));
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.status === 401
            ? "Entre como seller para consultar os pedidos da sua loja."
            : requestError.status === 403
              ? "Esta conta não pode consultar SellerOrders."
              : requestError.message
          : "Não foi possível carregar SellerOrders.",
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!authLoading && user?.role === "SELLER") void refresh();
  }, [authLoading, refresh, user?.role]);

  if (authLoading) {
    return <main className="p-8" role="status">Carregando sessão…</main>;
  }
  if (!user) {
    return (
      <main className="space-y-3 p-8">
        <p role="alert">Entre como seller.</p>
        <Button asChild><Link href="/login">Entrar</Link></Button>
      </main>
    );
  }
  if (user.role !== "SELLER") {
    return (
      <main className="p-8">
        <p role="alert">A área de SellerOrders é exclusiva para sellers.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <h1 className="text-3xl font-semibold">Pedidos da loja</h1>
      <p className="text-sm text-muted-foreground">
        A consulta é sempre derivada do seller autenticado. O identificador da
        URL serve apenas para navegação.
      </p>
      {error && (
        <p role="alert" className="rounded border border-destructive p-3 text-destructive">
          {error}
        </p>
      )}
      {loading && <p role="status">Carregando pedidos…</p>}
      {!loading && orders?.data.length === 0 && (
        <p className="rounded border p-5">Nenhum SellerOrder encontrado.</p>
      )}
      <div className="space-y-3">
        {orders?.data.map((order) => (
          <article
            key={order.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border p-4"
          >
            <div>
              <h2 className="font-semibold">SellerOrder {order.id}</h2>
              <p className="text-sm text-muted-foreground">
                {order.status} · {new Date(order.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
            <strong>
              {formatCurrency(order.totalInCents / 100)} {order.currency}
            </strong>
            <Button asChild variant="outline">
              <Link href={`/store/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(order.id)}`}>
                Detalhes
              </Link>
            </Button>
          </article>
        ))}
      </div>
      {orders && (
        <nav className="flex items-center justify-between" aria-label="Paginação dos SellerOrders">
          <span>
            Página {orders.pagination.page} de {orders.pagination.totalPages} · {orders.pagination.total} registros
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={page >= orders.pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Próxima
            </Button>
          </div>
        </nav>
      )}
    </main>
  );
}
