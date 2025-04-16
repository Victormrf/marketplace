"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Seller {
  storeName: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  seller: Seller;
  stock: number;
  description?: string;
  category?: string;
  createdAt?: string;
}

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (category) {
      const fetchProducts = async () => {
        try {
          const res = await fetch(
            `http://localhost:8000/products/category/${category}`
          );
          if (!res.ok) throw new Error("Erro ao buscar produtos");
          const data = await res.json();
          setProducts(Array.isArray(data.products) ? data.products : []);
        } catch (error) {
          console.error("Erro ao buscar produtos:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchProducts();
    }
  }, [category]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">
        Produtos da categoria: {category}
      </h1>

      {loading ? (
        <p>Carregando produtos...</p>
      ) : products.length === 0 ? (
        <p>Nenhum produto encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="border rounded-xl shadow-sm p-4 hover:shadow-md transition-all"
            >
              <h2 className="text-lg font-semibold mb-1">{product.name}</h2>
              <p className="text-sm text-gray-600 mb-2">
                {product.description}
              </p>
              <p className="text-base font-medium text-green-700 mb-2">
                R$ {product.price.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 mb-1">
                Vendido por:{" "}
                <span className="font-medium">{product.seller.storeName}</span>
              </p>
              <p className="text-sm text-gray-400">Estoque: {product.stock}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
