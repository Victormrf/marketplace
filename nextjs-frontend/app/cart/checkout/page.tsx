"use client";

import Link from "next/link";
import { useAuth } from "@/context/authContext";
import { useCheckout } from "@/hooks/useCheckout";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const isCustomer = !authLoading && user?.role === "CUSTOMER";
  const checkout = useCheckout(isCustomer ? user.id : null);

  if (authLoading) {
    return (
      <main className="mx-auto max-w-3xl p-8" role="status">
        Carregando sessão…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <h1 className="text-3xl font-semibold">Finalizar compra</h1>
        <p role="alert">Entre como customer para continuar.</p>
        <Button asChild>
          <Link href="/login?returnTo=%2Fcart%2Fcheckout">Entrar</Link>
        </Button>
      </main>
    );
  }

  if (user.role !== "CUSTOMER") {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p role="alert">Somente customers podem finalizar uma compra.</p>
      </main>
    );
  }

  if (checkout.loading) {
    return (
      <main className="mx-auto max-w-3xl p-8" role="status">
        Carregando carrinho e endereços…
      </main>
    );
  }

  const unavailable = checkout.cart?.items.some(
    (item) => !item.isAvailable || !item.hasSufficientStock,
  ) ?? false;
  const selectedAddress = checkout.addresses.find(
    (address) => address.id === checkout.selectedAddressId,
  );

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <div>
          <h1 className="text-3xl font-semibold">Finalizar compra</h1>
          <p className="text-sm text-muted-foreground">
            Selecione um endereço salvo. O pedido será montado pelo backend a
            partir do carrinho atual.
          </p>
        </div>
        {checkout.pending && (
          <p className="rounded border border-amber-500 p-3 text-sm" role="status">
            Há uma tentativa de checkout com resultado ainda não confirmado. O
            endereço está bloqueado e “Tentar novamente” reutilizará a mesma
            chave e o mesmo endereço.
          </p>
        )}
        {!checkout.addresses.length ? (
          <div className="space-y-3 rounded border p-5">
            <p>Nenhum endereço ativo foi encontrado.</p>
            <Button asChild variant="outline">
              <Link href="/profile">Gerenciar endereços</Link>
            </Button>
          </div>
        ) : (
          <fieldset
            className="space-y-3"
            disabled={checkout.submitting || Boolean(checkout.pending)}
          >
            <legend className="font-medium">Endereço de entrega</legend>
            {checkout.addresses.map((address) => (
              <label
                key={address.id}
                className="flex cursor-pointer gap-3 rounded border p-4"
              >
                <input
                  type="radio"
                  name="addressId"
                  value={address.id}
                  checked={checkout.selectedAddressId === address.id}
                  onChange={() => checkout.setSelectedAddressId(address.id)}
                />
                <span>
                  <span className="block font-medium">
                    {address.recipientName}
                    {address.isDefault ? " · Padrão" : ""}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {address.street}, {address.number}
                    {address.complement ? `, ${address.complement}` : ""} · {address.neighborhood}, {address.city} - {address.state} · {address.postalCode}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {checkout.error && (
          <p
            className="rounded border border-destructive p-3 text-sm text-destructive"
            role="alert"
          >
            {checkout.error}
          </p>
        )}
        <Button asChild variant="outline">
          <Link href="/cart">Voltar ao carrinho</Link>
        </Button>
      </section>

      <aside className="h-fit space-y-4 rounded-lg border p-5">
        <h2 className="text-xl font-semibold">Resumo do carrinho</h2>
        {!checkout.cart?.items.length && !checkout.pending ? (
          <p>O carrinho está vazio.</p>
        ) : checkout.cart?.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-4 text-sm">
            <span>{item.name} × {item.quantity}</span>
            <span>{formatCurrency(item.lineTotalInCents / 100)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-3">
          <span>Estimativa atual</span>
          <strong>{formatCurrency((checkout.cart?.totalInCents ?? 0) / 100)}</strong>
        </div>
        <p className="text-xs text-muted-foreground">
          Valor informativo. O backend revalida preços, estoque e endereço na
          transação; pagamento não faz parte desta etapa.
        </p>
        {selectedAddress && (
          <p className="text-xs text-muted-foreground">
            Entrega para {selectedAddress.recipientName}.
          </p>
        )}
        {unavailable && (
          <p className="text-sm text-destructive" role="alert">
            Há item indisponível ou sem estoque suficiente. Revise o carrinho.
          </p>
        )}
        <Button
          type="button"
          className="w-full"
          disabled={
            (!checkout.pending &&
              (!checkout.cart?.items.length ||
                !selectedAddress ||
                unavailable ||
                checkout.addresses.length === 0)) ||
            checkout.submitting
          }
          onClick={() => void checkout.submit()}
        >
          {checkout.submitting ? "Enviando…" : checkout.pending ? "Tentar novamente" : "Criar pedido"}
        </Button>
      </aside>
    </main>
  );
}
