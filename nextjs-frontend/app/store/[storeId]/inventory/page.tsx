"use client";

import { useState } from "react";
import { useAuth } from "@/context/authContext";
import { useSellerInventory } from "@/hooks/useSellerInventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SellerInventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    busy,
    error,
    inventory,
    loading,
    movementPage,
    movements,
    notice,
    productPage,
    productTotalPages,
    products,
    selectedProductId,
    setMovementPage,
    setProductPage,
    setSelectedProductId,
    submitMovement: runMovement,
  } = useSellerInventory(!authLoading && user?.role === "SELLER");
  const [quantity, setQuantity] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  async function submitMovement(kind: "restock" | "adjustment") {
    const succeeded = await runMovement(
      kind,
      Number(quantity),
      Number(delta),
      reason,
    );

    if (succeeded) {
      setQuantity("");
      setDelta("");
      setReason("");
    }
  }

  if (authLoading) {
    return <main className="p-8">Carregando sessão…</main>;
  }
  if (!user || user.role !== "SELLER") {
    return (
      <main className="p-8" role="alert">
        Acesso permitido somente a vendedores autenticados.
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">Inventário</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Estoque físico, quantidade reservada e disponibilidade são valores distintos.
      </p>

      {products.length > 0 && (
        <div className="mb-6 max-w-xl space-y-2">
          <Label htmlFor="inventory-product">Produto</Label>
          <select
            id="inventory-product"
            className="h-10 w-full rounded-md border bg-background px-3"
            value={selectedProductId}
            onChange={(event) => {
              setMovementPage(1);
              setSelectedProductId(event.target.value);
            }}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.reference ?? product.id})
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={productPage <= 1}
              onClick={() => {
                setSelectedProductId("");
                setProductPage((page) => page - 1);
              }}
            >
              Produtos anteriores
            </Button>
            <span>
              Produtos {productPage} / {productTotalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={productPage >= productTotalPages}
              onClick={() => {
                setSelectedProductId("");
                setProductPage((page) => page + 1);
              }}
            >
              Próximos produtos
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-4 text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 text-green-700">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Carregando inventário…</p>
      ) : !products.length ? (
        <p>Esta loja ainda não possui produtos ativos para gerenciar.</p>
      ) : inventory ? (
        <>
          <section className="mb-8 grid gap-4 sm:grid-cols-3">
            <InventoryValue
              label="Estoque físico (on hand)"
              value={inventory.onHandQuantity}
            />
            <InventoryValue label="Reservado" value={inventory.reservedQuantity} />
            <InventoryValue
              label="Disponível para venda"
              value={inventory.availableQuantity}
            />
          </section>

          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border p-5">
              <h2 className="mb-4 text-xl font-semibold">Entrada de estoque</h2>
              <div className="space-y-3">
                <Label htmlFor="restock-quantity">Quantidade inteira positiva</Label>
                <Input
                  id="restock-quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
                <Label htmlFor="restock-reason">Motivo (opcional)</Label>
                <Input
                  id="restock-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <Button
                  disabled={busy || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0}
                  onClick={() => void submitMovement("restock")}
                >
                  Registrar reposição
                </Button>
              </div>
            </div>
            <div className="rounded-lg border p-5">
              <h2 className="mb-4 text-xl font-semibold">Ajuste manual</h2>
              <div className="space-y-3">
                <Label htmlFor="inventory-delta">
                  Variação do estoque físico (delta, diferente de zero)
                </Label>
                <Input
                  id="inventory-delta"
                  type="number"
                  step="1"
                  value={delta}
                  onChange={(event) => setDelta(event.target.value)}
                />
                <Label htmlFor="adjustment-reason">Motivo obrigatório</Label>
                <Input
                  id="adjustment-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={
                    busy ||
                    !Number.isInteger(Number(delta)) ||
                    Number(delta) === 0 ||
                    !reason.trim()
                  }
                  onClick={() => void submitMovement("adjustment")}
                >
                  Registrar ajuste
                </Button>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Histórico de movimentações</h2>
            {!movements?.data.length ? (
              <p>Nenhuma movimentação registrada.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Delta físico</th>
                      <th className="p-3">Após</th>
                      <th className="p-3">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.data.map((movement) => (
                      <tr key={movement.id} className="border-t">
                        <td className="p-3">
                          {new Date(movement.createdAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3">{movement.movementType}</td>
                        <td className="p-3">
                          {movement.onHandDelta > 0 ? "+" : ""}
                          {movement.onHandDelta}
                        </td>
                        <td className="p-3">
                          Físico {movement.onHandAfter} · Reservado {movement.reservedAfter}
                        </td>
                        <td className="p-3">{movement.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                disabled={movementPage <= 1}
                onClick={() => setMovementPage((page) => page - 1)}
              >
                Anterior
              </Button>
              <span>
                Página {movements?.pagination.page ?? 1} de {movements?.pagination.totalPages ?? 0}
              </span>
              <Button
                variant="outline"
                disabled={!movements || movementPage >= movements.pagination.totalPages}
                onClick={() => setMovementPage((page) => page + 1)}
              >
                Próxima
              </Button>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function InventoryValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
