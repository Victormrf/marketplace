"use client";

import { Heart, Search } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

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
  averageRating?: number;
  createdAt?: string;
}

interface DecodedToken {
  id: string;
  email: string;
  role: "customer" | "seller" | "admin";
}

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Função para adicionar ao carrinho
  function handleAddToCart(productId: string) {
    // Verifica se existe um usuário logado
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    let userId: string | null = null;

    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        userId = decoded.id;
      } catch {
        userId = null;
      }
    }

    if (userId) {
      // Usuário logado: adiciona no backend
      fetch("http://localhost:8000/cart-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          productId,
          quantity: 1,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Erro ao adicionar ao carrinho");
          alert("Produto adicionado ao carrinho!");
        })
        .catch((error) => {
          alert("Erro ao adicionar ao carrinho.");
          console.error(error);
        });
    } else {
      // Tenta obter o carrinho do localStorage, ou inicia como array vazio
      const cart = JSON.parse(localStorage.getItem("cart") || "[]");
      const existing = cart.find(
        (item: { productId: string; quantity: number }) =>
          item.productId === productId
      );
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({ productId, quantity: 1 });
      }
      localStorage.setItem("cart", JSON.stringify(cart));
      alert("Produto adicionado ao carrinho!");
    }
  }

  useEffect(() => {
    if (category) {
      const fetchProducts = async () => {
        try {
          const res = await fetch(
            `http://localhost:8000/products/category/${category}`
          );
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
      <div className="bg-gray-100">
        <h1 className="text-2xl font-bold mb-2 pt-4 px-4">
          {category?.toUpperCase()} PRODUCTS
        </h1>
        <div className="flex justify-center max-w-md mx-auto pb-8">
          <input
            type="text"
            placeholder="Search for products..."
            className="px-4 py-2 w-full border border-gray-300 rounded-l"
          />
          <button className="flex items-center justify-center gap-2 px-4 bg-slate-900 text-white rounded-r hover:bg-slate-800">
            <Search />
          </button>
        </div>
      </div>

      {loading ? (
        <p>Carregando produtos...</p>
      ) : products.length === 0 ? (
        <p>Nenhum produto encontrado.</p>
      ) : (
        <div className="px-4 sm:px-8 md:px-16 lg:px-24 xl:px-32 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pt-12">
          {products.map((product) => (
            <div
              key={product.id}
              className="w-full bg-background border border-gray-200 rounded-lg shadow-sm flex flex-col"
            >
              <div className="flex justify-center p-4">
                <Image
                  className="rounded-lg object-contain"
                  width={160}
                  height={200}
                  src={product.image || "/images/blank-shirt-model.jpg"}
                  alt="Imagem do produto"
                />
              </div>
              <div className="px-5 pb-5 flex-1 flex flex-col justify-between">
                <div>
                  <h5 className="text-gray-800 text-xl font-semibold tracking-tight">
                    {product.name}
                  </h5>
                  <div className="flex items-center mt-2.5 mb-3">
                    <div className="flex items-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.round(product.averageRating || 0)
                              ? "text-yellow-400"
                              : "text-gray-500"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 22 20"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M10 15l-5.878 3.09L5.5 12.5 1 8.91l6.061-.882L10 2.5l2.939 5.528L19 8.91l-4.5 3.59 1.378 5.59z" />
                        </svg>
                      ))}
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-sm ms-3">
                      {product.averageRating?.toFixed(1) || "N/A"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    {product.seller.storeName}
                  </span>
                  <span className="text-xs text-gray-500">
                    Stock: {product.stock}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-800 text-2xl font-bold">
                    $ {product.price.toFixed(2)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="text-white bg-slate-500 hover:bg-slate-700 font-medium rounded-lg text-sm px-4 py-2"
                      onClick={() => handleAddToCart(product.id)}
                    >
                      Add to cart
                    </button>
                    <button className="text-red-300 bg-white border border-red-300 hover:border-red-600 hover:text-red-600  font-medium rounded-lg text-sm px-4 py-2">
                      <Heart />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
