"use client";
import { useSearchParams } from "next/navigation";

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">
        Produtos da categoria: {category}
      </h1>
      {/* Renderize os produtos filtrados aqui */}
    </div>
  );
}
