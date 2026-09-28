"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PaymentAttemptRefunds } from "@/components/orders/PaymentAttemptRefunds";
import { useAuth } from "@/context/authContext";
import { ApiError } from "@/lib/http";
import { formatCurrency } from "@/lib/utils";
import { getMyOrder } from "@/services/ordersV2";
import { usePaymentAttempts } from "@/hooks/usePaymentAttempts";
import type { OrderDetailV2 } from "@/types/ordersV2";
import type { PaymentMethodV2 } from "@/types/payments";

const paymentMethods: { value: PaymentMethodV2; label: string }[] = [
  { value: "PIX", label: "Pix" },
  { value: "CREDIT_CARD", label: "Cartão de crédito" },
  { value: "DEBIT_CARD", label: "Cartão de débito" },
  { value: "PAYPAL", label: "PayPal" },
];

export default function OrderDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetailV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodV2>("PIX");
  const payments = usePaymentAttempts(
    params.orderId,
    Boolean(user?.role === "CUSTOMER" && order),
  );

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
      <section className="space-y-4 rounded border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Tentativas de pagamento</h2>
            <p className="text-sm text-muted-foreground">
              Cada tentativa cobra o valor integral do pedido:{" "}
              {formatCurrency(order.totalInCents / 100)} {order.currency}.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void payments.reload()}
            disabled={payments.loading}
          >
            {payments.loading ? "Atualizando…" : "Atualizar tentativas"}
          </Button>
        </div>

        {order.status === "PENDING_PAYMENT" && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">
              Método de pagamento
              <select
                className="h-10 rounded-md border bg-background px-3"
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as PaymentMethodV2)
                }
                disabled={
                  payments.submitting ||
                  payments.eligibilityLoading ||
                  Boolean(payments.eligibilityError) ||
                  !payments.canStartAttempt
                }
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              onClick={() =>
                void payments.startAttempt({ method: paymentMethod })
              }
              disabled={
                payments.submitting ||
                payments.loading ||
                payments.eligibilityLoading ||
                Boolean(payments.eligibilityError) ||
                !payments.canStartAttempt
              }
            >
              {payments.submitting ? "Criando tentativa…" : "Iniciar tentativa"}
            </Button>
          </div>
        )}

        {order.status === "PENDING_PAYMENT" &&
          payments.eligibilityLoading && (
            <p className="text-sm" role="status">
              Verificando se o pedido aceita uma nova tentativa...
            </p>
          )}
        {order.status === "PENDING_PAYMENT" &&
          !payments.eligibilityLoading &&
          !payments.eligibilityError &&
          !payments.canStartAttempt && (
            <p className="text-sm" role="status">
              O pedido já possui uma tentativa ativa ou capturada. Consulte o
              estado abaixo; não é possível iniciar outra agora.
            </p>
          )}
        {order.status === "PENDING_PAYMENT" && (
          <p className="text-sm text-muted-foreground">
            Iniciar uma tentativa não significa que o pedido foi pago. A captura
            e a confirmação dependem do processamento do backend/provedor; esta
            tela não simula sucesso.
          </p>
        )}

        {(payments.error || payments.eligibilityError) && (
          <p
            className="rounded border border-destructive p-3 text-sm text-destructive"
            role="alert"
          >
            {payments.error ?? payments.eligibilityError}
          </p>
        )}

        {payments.loading && payments.attempts.length === 0 ? (
          <p role="status">Carregando tentativas…</p>
        ) : payments.attempts.length === 0 ? (
          <p>Nenhuma tentativa de pagamento foi registrada.</p>
        ) : (
          <div className="space-y-3">
            {payments.attempts.map((attempt) => (
              <article key={attempt.id} className="space-y-2 rounded border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-medium">
                    {attempt.method} · {attempt.status}
                  </h3>
                  <span>
                    {formatCurrency(attempt.amountInCents / 100)}{" "}
                    {attempt.currency}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {attempt.provider}
                  {attempt.providerReference
                    ? ` · Referência: ${attempt.providerReference}`
                    : " · Aguardando referência do provedor"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Criada em {new Date(attempt.createdAt).toLocaleString("pt-BR")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void payments.refreshAttempt(attempt.id)}
                >
                  Consultar status
                </Button>
                <PaymentAttemptRefunds attempt={attempt} />
              </article>
            ))}
          </div>
        )}

        {payments.pagination && payments.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => payments.setPage(payments.page - 1)}
              disabled={payments.page <= 1 || payments.loading}
            >
              Anterior
            </Button>
            <span className="text-sm">
              Página {payments.page} de {payments.pagination.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => payments.setPage(payments.page + 1)}
              disabled={
                payments.page >= payments.pagination.totalPages ||
                payments.loading
              }
            >
              Próxima
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
