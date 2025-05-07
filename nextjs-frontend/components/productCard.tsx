"use client";

import Image from "next/image";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Product = {
  id: string;
  sellerId: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category: string;
  image?: string;
  createdAt: Date;
};

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  // Determinar o status do estoque
  const getStockStatus = () => {
    if (product.stock <= 0)
      return { label: "Sem estoque", variant: "destructive" as const };
    if (product.stock < 5)
      return { label: "Estoque baixo", variant: "warning" as const };
    return {
      label: `${product.stock} em estoque`,
      variant: "outline" as const,
    };
  };

  const stockStatus = getStockStatus();

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all hover:shadow-md"
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
          <div className="flex justify-between items-start">
            <h3 className="font-medium line-clamp-2">{product.name}</h3>
          </div>
          <div className="flex justify-between items-center">
            <p className="font-bold text-lg">{formatCurrency(product.price)}</p>
            <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{product.category}</p>
        </div>
      </CardContent>
    </Card>
  );
}
