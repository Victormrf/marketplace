"use client";

import { useCallback, useEffect, useState } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/authContext";
import { ApiError } from "@/lib/http";
import { formatCurrency } from "@/lib/utils";
import { listMyOrders } from "@/services/ordersV2";
import type { OrderStatusV2, OrderSummaryV2, Paged } from "@/types/ordersV2";

const statuses: OrderStatusV2[] = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PARTIALLY_COMPLETED",
  "COMPLETED",
  "CANCELLED",
];

function OrdersClientPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [result, setResult] = useState<Paged<OrderSummaryV2> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const page = searchParams.get("page") ?? "1";
  const limit = searchParams.get("limit") ?? "20";
  const status = searchParams.get("status") ?? "";
  const createdFrom = searchParams.get("createdFrom") ?? "";
  const createdTo = searchParams.get("createdTo") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(
        await listMyOrders({
          page: Number(page),
          limit: Number(limit),
          ...(status ? { status: status as OrderStatusV2 } : {}),
          ...(createdFrom ? { createdFrom } : {}),
          ...(createdTo ? { createdTo } : {}),
        }),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.status === 401
            ? "Entre como customer para consultar seus pedidos."
            : requestError.status === 403
              ? "Esta conta não tem permissão para consultar pedidos de customer."
              : requestError.message
          : "Não foi possível carregar os pedidos.",
      );
    } finally {
      setLoading(false);
    }
  }, [createdFrom, createdTo, limit, page, status]);

  useEffect(() => {
    if (!authLoading && user?.role === "CUSTOMER") void load();
  }, [authLoading, load, user?.role, query]);

  function updateQuery(values: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if ("page" in values === false) next.set("page", "1");
    router.replace(`${pathname}?${next.toString()}`);
  }

  if (authLoading) {
    return (
      <main className="p-8" role="status">
        Carregando sessão…
      </main>
    );
  }
  if (!user) {
    return (
      <main className="space-y-4 p-8">
        <h1 className="text-3xl font-semibold">Meus pedidos</h1>
        <p role="alert">Entre como customer para continuar.</p>
        <Button asChild>
          <Link href="/login?returnTo=%2Forders">Entrar</Link>
        </Button>
      </main>
    );
  }
  if (user.role !== "CUSTOMER") {
    return (
      <main className="p-8">
        <p role="alert">Esta lista é exclusiva para customers.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-semibold">Meus pedidos</h1>
      <form
        className="grid gap-3 rounded border p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          updateQuery({
            status: String(data.get("status") ?? ""),
            createdFrom: String(data.get("createdFrom") ?? ""),
            createdTo: String(data.get("createdTo") ?? ""),
            page: "1",
          });
        }}
      >
        <label className="grid gap-1 text-sm">
          Status
          <select className="rounded border p-2" name="status" defaultValue={status}>
            <option value="">Todos</option>
            {statuses.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Criado de
          <input className="rounded border p-2" type="date" name="createdFrom" defaultValue={createdFrom} />
        </label>
        <label className="grid gap-1 text-sm">
          Criado até
          <input className="rounded border p-2" type="date" name="createdTo" defaultValue={createdTo} />
        </label>
        <label className="grid gap-1 text-sm">
          Itens por página
          <select
            className="rounded border p-2"
            name="limit"
            value={limit}
            onChange={(event) => updateQuery({ limit: event.target.value, page: "1" })}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button type="submit">Aplicar filtros</Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="rounded border border-destructive p-3 text-destructive">
          {error}
        </p>
      )}
      {loading && <p role="status">Carregando pedidos…</p>}
      {!loading && result?.data.length === 0 && (
        <p className="rounded border p-5">Nenhum pedido encontrado.</p>
      )}
      <div className="space-y-3">
        {result?.data.map((order) => (
          <article
            key={order.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded border p-4"
          >
            <div>
              <h2 className="font-semibold">Pedido {order.id}</h2>
              <p className="text-sm text-muted-foreground">
                {order.status} · {new Date(order.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
            <strong>{formatCurrency(order.totalInCents / 100)}</strong>
            <Button asChild variant="outline">
              <Link href={`/orders/${order.id}`}>Ver pedido</Link>
            </Button>
          </article>
        ))}
      </div>
      {result && (
        <nav className="flex items-center justify-between" aria-label="Paginação dos pedidos">
          <span>
            Página {result.pagination.page} de {result.pagination.totalPages} · {result.pagination.total} pedidos
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={result.pagination.page <= 1}
              onClick={() => updateQuery({ page: String(result.pagination.page - 1) })}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={result.pagination.page >= result.pagination.totalPages}
              onClick={() => updateQuery({ page: String(result.pagination.page + 1) })}
            >
              Próxima
            </Button>
          </div>
        </nav>
      )}
    </main>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<main className="p-8" role="status">Carregando filtros…</main>}>
      <OrdersClientPage />
    </Suspense>
  );
}
