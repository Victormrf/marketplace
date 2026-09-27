"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ProductCard } from "@/components/productCard";
import { ProductModal } from "@/components/editProductModal";
import { NewProductModal } from "@/components/newProductModal";
import { ApiError } from "@/lib/http";
import { getMySellerProfile } from "@/services/seller";
import { listSellerProducts } from "@/services/catalog";
import type { ProductCollectionDto, ProductReadDto } from "@/types/product";
import { useAuth } from "@/context/authContext";

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

export default function SellerProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();
  const query = useMemo(() => new URLSearchParams(queryKey), [queryKey]);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [collection, setCollection] = useState<ProductCollectionDto | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductReadDto | null>(null);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || user.role !== "SELLER") return;
    let active = true;
    getMySellerProfile()
      .then((profile) => {
        if (active) setSellerId(profile.id);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof ApiError
              ? requestError.message
              : "Não foi possível carregar o perfil da loja.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (!sellerId) return;
    let active = true;
    setLoading(true);
    setError(null);
    listSellerProducts(sellerId, query)
      .then((result) => {
        if (active) setCollection(result);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof ApiError
              ? requestError.message
              : "Não foi possível carregar seus produtos.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sellerId, query, refreshKey]);

  function navigateWithQuery(next: URLSearchParams) {
    router.push(`${pathname}?${next.toString()}`);
  }

  function changePage(page: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(page));
    navigateWithQuery(next);
  }

  if (authLoading) return <main className="p-8">Carregando sessão…</main>;
  if (!user || user.role !== "SELLER") {
    return <main className="p-8" role="alert">Acesso permitido somente a vendedores autenticados.</main>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-gray-50 px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Produtos da loja</h1>
          <p className="text-sm text-muted-foreground">O estoque é gerenciado separadamente no inventário.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={sellerId ? `/store/${sellerId}/inventory` : "#"}>Inventário</Link>
          </Button>
          <Button onClick={() => setNewProductOpen(true)}>
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        </div>
      </header>

      <form
        className="mb-5 flex gap-2"
        action=""
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const next = new URLSearchParams(searchParams.toString());
          const value = String(form.get("search") ?? "").trim();
          const category = String(form.get("category") ?? "");
          if (value) next.set("search", value);
          else next.delete("search");
          if (category) next.set("category", category);
          else next.delete("category");
          next.set("page", "1");
          navigateWithQuery(next);
        }}
      >
        <Input name="search" defaultValue={query.get("search") ?? ""} placeholder="Buscar seus produtos" />
        <select
          name="category"
          aria-label="Filtrar categoria"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          defaultValue={query.get("category") ?? ""}
        >
          <option value="">Todas as categorias</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <Button type="submit" variant="outline" aria-label="Buscar">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      {error && <p role="alert" className="mb-4 text-destructive">{error}</p>}
      {loading ? (
        <p role="status">Carregando produtos…</p>
      ) : collection?.data.length ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {collection.pagination.total} produto(s) · página {" "}
            {collection.pagination.page} de {collection.pagination.totalPages || 1}
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {collection.data.map((product) => (
              <ProductCard key={product.id} product={product} onClick={() => setSelectedProduct(product)} />
            ))}
          </div>
          <div className="mt-6 flex justify-center gap-4">
            <Button
              variant="outline"
              disabled={collection.pagination.page <= 1}
              onClick={() => changePage(collection.pagination.page - 1)}
            >Anterior</Button>
            <Button
              variant="outline"
              disabled={collection.pagination.page >= collection.pagination.totalPages}
              onClick={() => changePage(collection.pagination.page + 1)}
            >Próxima</Button>
          </div>
        </>
      ) : (
        <Card><CardContent className="py-10 text-center">Nenhum produto encontrado.</CardContent></Card>
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          isOpen
          onClose={() => setSelectedProduct(null)}
          onUpdate={(product) => {
            setSelectedProduct(product);
            setRefreshKey((key) => key + 1);
          }}
        />
      )}
      <NewProductModal
        isOpen={newProductOpen}
        onClose={() => {
          setNewProductOpen(false);
          setRefreshKey((key) => key + 1);
        }}
      />
    </main>
  );
}
