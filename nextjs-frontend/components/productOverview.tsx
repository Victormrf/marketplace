import Image from "next/image";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { ProductReadDto } from "@/types/product";
import { CollapsibleText } from "./collapsibleText";
import { ReviewCollection } from "./reviews/ReviewCollection";

export default function ProductOverview({
  product,
  onAddToCart,
  addingToCart = false,
  cartMessage,
}: {
  product: ProductReadDto;
  onAddToCart?: () => void;
  addingToCart?: boolean;
  cartMessage?: { text: string; error: boolean } | null;
}) {
  const available = product.isAvailable;

  return (
    <section className="bg-white antialiased dark:bg-gray-900">
      <div className="mx-auto max-w-screen-xl 2xl:px-0">
        <div className="items-center gap-8 lg:grid lg:grid-cols-[260px_1fr] xl:gap-12">
          <div className="flex justify-center">
            <Image
              height={260}
              width={260}
              className="h-[260px] w-[260px] object-contain"
              src={product.image || "/placeholder.svg"}
              alt={product.name}
              priority
            />
          </div>
          <div className="mt-4 lg:mt-0">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
              {product.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vendido por {product.sellerName}
            </p>
            <p className="mt-3 text-3xl font-extrabold text-gray-900 dark:text-white">
              {formatCurrency(product.priceInCents / 100)}
            </p>
            <p
              className={`mt-3 font-medium ${available ? "text-green-700" : "text-red-700"}`}
            >
              {available
                ? `${product.inventory.availableQuantity} unidades disponíveis`
                : "Produto indisponível no momento"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Estoque físico: {product.inventory.onHandQuantity}; reservado: {product.inventory.reservedQuantity}.
            </p>
            {product.averageRating !== null && (
              <p className="mt-2 text-sm">
                Avaliação média: {product.averageRating.toFixed(1)} / 5
              </p>
            )}
            <hr className="my-5 border-gray-200 dark:border-gray-800" />
            <CollapsibleText
              text={product.description || "Sem descrição disponível."}
              maxLength={260}
            />
            {onAddToCart && (
              <div className="mt-5 space-y-2">
                <Button
                  type="button"
                  disabled={!product.isAvailable || addingToCart}
                  onClick={onAddToCart}
                >
                  {addingToCart ? "Adicionando…" : "Adicionar ao carrinho"}
                </Button>
                {cartMessage && (
                  <p
                    className={cartMessage.error ? "text-sm text-destructive" : "text-sm text-green-700"}
                    role={cartMessage.error ? "alert" : "status"}
                  >
                    {cartMessage.text}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <ReviewCollection
            targetKind="product"
            targetId={product.id}
            targetName={product.name}
          />
          <ReviewCollection
            targetKind="seller"
            targetId={product.sellerId}
            targetName={product.sellerName}
          />
        </div>
      </div>
    </section>
  );
}
