"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProductOverview from "@/components/productOverview";
import { ProductCard } from "@/components/productCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";
import { getProduct } from "@/services/catalog";
import { addCartItem } from "@/services/cart";
import { useProducts } from "@/hooks/useProducts";
import type { ProductReadDto } from "@/types/product";

const CATEGORIES = [
  "OFFICE",
  "SPORTS",
  "BOOKS",
  "BEAUTY",
  "CLOTHING",
  "TOYS",
  "TV_PROJECTORS",
  "SMARTPHONES_TABLETS",
  "ELECTRONICS",
  "PETS",
  "FURNITURE",
];

export default function ProductsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [sellerId, setSellerId] = useState(searchParams.get("sellerId") ?? "");
  const [inStock, setInStock] = useState(searchParams.get("inStock") ?? "");
  const [selectedProduct, setSelectedProduct] = useState<ProductReadDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  const activeQuery = useMemo(() => new URLSearchParams(queryKey), [queryKey]);
  const { collection, loading, error } = useProducts(activeQuery);

  useEffect(() => {
    setSearch(activeQuery.get("search") ?? "");
    setCategory(activeQuery.get("category") ?? "");
    setSellerId(activeQuery.get("sellerId") ?? "");
    setInStock(activeQuery.get("inStock") ?? "");
    setDetailError(null);
  }, [activeQuery]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    const normalizedSearch = search.trim();
    const normalizedSellerId = sellerId.trim();

    if (normalizedSearch) next.set("search", normalizedSearch);
    if (category) next.set("category", category);
    if (normalizedSellerId) next.set("sellerId", normalizedSellerId);
    if (inStock) next.set("inStock", inStock);
    next.set("page", "1");
    next.set("limit", searchParams.get("limit") ?? "12");

    router.push(`${pathname}?${next.toString()}`);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(page));
    router.push(`${pathname}?${next.toString()}`);
  }

  async function openProduct(productId: string) {
    setDetailLoading(true);
    setDetailError(null);
    setCartMessage(null);
    setSelectedProduct(null);
    try {
      setSelectedProduct(await getProduct(productId));
    } catch (requestError) {
      setDetailError(
        requestError instanceof ApiError
          ? requestError.message
          : "Não foi possível carregar os detalhes do produto.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function addSelectedProductToCart() {
    if (!selectedProduct) return;

    setAddingToCart(true);
    setCartMessage(null);
    try {
      await addCartItem({ productId: selectedProduct.id, quantity: 1 });
      setCartMessage({ text: "Produto adicionado ao carrinho.", error: false });
    } catch (requestError) {
      const message = requestError instanceof ApiError
        ? requestError.status === 401
          ? "Entre como customer para adicionar ao carrinho."
          : requestError.status === 403
            ? "Somente customers podem operar o carrinho."
            : requestError.status === 409
              ? "O produto ficou indisponível ou o estoque mudou."
              : requestError.message
        : "Não foi possível adicionar o produto ao carrinho.";
      setCartMessage({ text: message, error: true });
    } finally {
      setAddingToCart(false);
    }
  }

  const pagination = collection?.pagination;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">Início</Link>
        <span>/</span>
        <span>Produtos</span>
      </div>
      <h1 className="mb-5 text-3xl font-bold">Catálogo de produtos</h1>

      <form
        className="mb-6 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2 lg:grid-cols-5"
        onSubmit={applyFilters}
      >
        <Input
          aria-label="Buscar produtos"
          placeholder="Buscar produtos"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Categoria"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">Todas as categorias</option>
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <Input
          aria-label="ID do seller"
          placeholder="Filtrar por seller ID"
          value={sellerId}
          onChange={(event) => setSellerId(event.target.value)}
        />
        <select
          aria-label="Disponibilidade"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={inStock}
          onChange={(event) => setInStock(event.target.value)}
        >
          <option value="">Disponíveis e indisponíveis</option>
          <option value="true">Somente disponíveis</option>
          <option value="false">Somente indisponíveis</option>
        </select>
        <Button type="submit">Aplicar filtros</Button>
      </form>

      {pagination && (
        <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
          {pagination.total} produto(s) correspondente(s) · página {pagination.page} de {pagination.totalPages || 1}
        </p>
      )}
      {loading ? (
        <p role="status">Carregando produtos…</p>
      ) : error || detailError ? (
        <p role="alert" className="text-destructive">{detailError ?? error}</p>
      ) : collection?.data.length ? (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {collection.data.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => void openProduct(product.id)}
              />
            ))}
          </div>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button
              type="button"
              variant="outline"
              disabled={!pagination || pagination.page <= 1}
              onClick={() => pagination && goToPage(pagination.page - 1)}
            >
              Anterior
            </Button>
            <span>Página {pagination?.page ?? 1} / {pagination?.totalPages ?? 0}</span>
            <Button
              type="button"
              variant="outline"
              disabled={!pagination || pagination.page >= pagination.totalPages}
              onClick={() => pagination && goToPage(pagination.page + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      ) : (
        <p>Nenhum produto encontrado para esses filtros.</p>
      )}

      {(detailLoading || selectedProduct) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            if (!detailLoading) setSelectedProduct(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6"
            onClick={(event) => event.stopPropagation()}
          >
            {detailLoading ? (
              <p role="status">Carregando detalhes…</p>
            ) : selectedProduct ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="mb-4"
                  onClick={() => setSelectedProduct(null)}
                >
                  Fechar
                </Button>
                <ProductOverview
                  product={selectedProduct}
                  onAddToCart={() => void addSelectedProductToCart()}
                  addingToCart={addingToCart}
                  cartMessage={cartMessage}
                />
              </>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
