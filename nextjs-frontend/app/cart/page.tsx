"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/authContext";
import { useCart } from "@/hooks/useCart";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const isCustomer = !authLoading && user?.role === "CUSTOMER";
  const cartState = useCart(isCustomer);

  if (authLoading) {
    return (
      <main className="mx-auto max-w-5xl p-8" role="status">
        Carregando sessão…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <h1 className="text-3xl font-semibold">Carrinho</h1>
        <p role="alert">Entre como customer para consultar o carrinho da sua conta.</p>
        <p className="text-sm text-muted-foreground">
          Itens de um carrinho anônimo legado não são importados nem enviados ao checkout.
        </p>
        <Button asChild>
          <Link href="/login?returnTo=%2Fcart">Entrar</Link>
        </Button>
      </main>
    );
  }

  if (user.role !== "CUSTOMER") {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <h1 className="text-3xl font-semibold">Carrinho</h1>
        <p role="alert">Somente customers podem consultar e alterar um carrinho.</p>
      </main>
    );
  }

  if (cartState.loading) {
    return (
      <main className="mx-auto max-w-5xl p-8" role="status">
        Carregando carrinho…
      </main>
    );
  }

  const cart = cartState.cart;

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]">
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Meu carrinho</h1>
            <p className="text-sm text-muted-foreground">
              O estoque exibido é informativo e será validado novamente no checkout.
            </p>
          </div>
          {cart?.items.length ? (
            <Button
              type="button"
              variant="outline"
              disabled={cartState.mutating}
              onClick={() => {
                if (window.confirm("Remover todos os itens do carrinho?")) {
                  void cartState.clear();
                }
              }}
            >
              Limpar carrinho
            </Button>
          ) : null}
        </div>

        {cartState.error && (
          <p
            role="alert"
            className="rounded-md border border-destructive p-3 text-sm text-destructive"
          >
            {cartState.error}
          </p>
        )}

        {!cart?.items.length ? (
          <div className="rounded-lg border p-6 text-muted-foreground">
            Seu carrinho está vazio.{" "}
            <Link className="underline" href="/products">
              Explorar produtos
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.items.map((item) => {
              const canIncrease =
                item.isAvailable && item.quantity < item.availableQuantity;

              return (
                <article
                  key={item.id}
                  className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[96px_1fr]"
                >
                  <Image
                    src={item.image || "/placeholder.svg"}
                    alt={item.name}
                    width={96}
                    height={96}
                    className="h-24 w-24 rounded object-cover"
                  />
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="font-semibold">{item.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(item.priceInCents / 100)} cada
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Disponíveis agora: {item.availableQuantity}
                      </p>
                      {!item.hasSufficientStock ? (
                        <p className="text-sm font-medium text-destructive">
                          Estoque insuficiente para as {item.quantity} unidades solicitadas.
                        </p>
                      ) : !item.isAvailable ? (
                        <p className="text-sm font-medium text-destructive">
                          Produto ou seller indisponível. O item permanece no carrinho.
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2 text-right">
                      <p className="font-semibold">
                        {formatCurrency(item.lineTotalInCents / 100)}
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`Diminuir quantidade de ${item.name}`}
                          disabled={cartState.mutating || item.quantity <= 1}
                          onClick={() =>
                            void cartState.updateItem(
                              item.productId,
                              item.quantity - 1,
                            )
                          }
                        >
                          −
                        </Button>
                        <span aria-label={`Quantidade ${item.quantity}`}>
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`Aumentar quantidade de ${item.name}`}
                          disabled={cartState.mutating || !canIncrease}
                          onClick={() =>
                            void cartState.updateItem(
                              item.productId,
                              item.quantity + 1,
                            )
                          }
                        >
                          +
                        </Button>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={cartState.mutating}
                        onClick={() => {
                          if (window.confirm(`Remover ${item.name} do carrinho?`)) {
                            void cartState.removeItem(item.productId);
                          }
                        }}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <aside className="h-fit space-y-4 rounded-lg border p-5">
        <h2 className="text-xl font-semibold">Resumo estimado</h2>
        <div className="flex justify-between gap-4">
          <span>Subtotal atual</span>
          <strong>{formatCurrency((cart?.totalInCents ?? 0) / 100)}</strong>
        </div>
        <p className="text-sm text-muted-foreground">
          Total calculado pelo backend com preços atuais; não é um preço final de checkout.
        </p>
        {cart?.items.length &&
        cart.items.every((item) => item.isAvailable && item.hasSufficientStock) ? (
          <Button asChild className="w-full">
            <Link href="/cart/checkout">Prosseguir para checkout</Link>
          </Button>
        ) : (
          <Button type="button" className="w-full" disabled>
            Prosseguir para checkout
          </Button>
        )}
      </aside>
    </main>
  );
}
