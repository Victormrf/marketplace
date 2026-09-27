"use client";

import Image from "next/image";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProductReadDto } from "@/types/product";

interface ProductCardProps {
  product: ProductReadDto;
  onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const availableQuantity = product.inventory.availableQuantity;
  const availabilityLabel = product.isAvailable
    ? `${availableQuantity} disponíveis`
    : "Indisponível";

  return (
    <Card
      className="cursor-pointer overflow-hidden transition-all hover:shadow-md"
      onClick={onClick}
    >
      <div className="relative aspect-square">
        <Image
          src={product.image || "/placeholder.svg"}
          alt={product.name}
          fill
          className="object-cover"
        />
      </div>
      <CardContent className="p-4">
        <div className="flex flex-col gap-2">
          <h3 className="line-clamp-2 font-medium">{product.name}</h3>
          <p className="text-sm text-muted-foreground">{product.sellerName}</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-lg font-bold">
              {formatCurrency(product.priceInCents / 100)}
            </p>
            <Badge variant={product.isAvailable ? "outline" : "destructive"}>
              {availabilityLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{product.category}</p>
        </div>
      </CardContent>
    </Card>
  );
}
