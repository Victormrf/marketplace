"use client";

import { Heart, Search } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ProductOverview from "@/components/productOverview";
import SuccessPopup from "@/components/popups/successPopup";

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

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successPosition, setSuccessPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  // Função para adicionar ao carrinho
  async function handleAddToCart(
    productId: string,
    btnElement: HTMLButtonElement
  ) {
    try {
      // Verifica se existe um usuário logado usando a rota /me
      const userRes = await fetch("http://localhost:8000/users/me", {
        method: "GET",
        credentials: "include",
      });

      if (userRes.ok) {
        // Usuário está logado, adiciona no backend
        const addToCartRes = await fetch("http://localhost:8000/cart-items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            productId,
            quantity: 1,
          }),
        });

        if (!addToCartRes.ok) {
          throw new Error("Erro ao adicionar ao carrinho");
        }
      } else {
        // Usuário não está logado, salva no localStorage
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
      }

      // Mostra popup de sucesso
      const rect = btnElement.getBoundingClientRect();
      setSuccessPosition({
        top: rect.top + window.scrollY - 40,
        left: rect.left + window.scrollX + rect.width / 2,
      });
      setShowSuccess(true);
    } catch (error) {
      console.error("Erro ao adicionar ao carrinho:", error);
      alert("Erro ao adicionar ao carrinho.");
    }
  }

  const handleSearch = () => {
    if (!products) return;

    const filtered = products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFilteredProducts(filtered);
  };

  useEffect(() => {
    if (category) {
      const fetchProducts = async () => {
        try {
          const res = await fetch(
            `http://localhost:8000/products/category/${category}`
          );
          const data = await res.json();
          const productsList = Array.isArray(data.products)
            ? data.products
            : [];
          setProducts(productsList);
          setFilteredProducts(productsList);
        } catch (error) {
          console.error("Erro ao buscar produtos:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchProducts();
    }
  }, [category]);

  function handleProductClick(product: Product) {
    setSelectedProduct(product);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedProduct(null);
  }

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
            className="px-4 py-2 w-full border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-slate-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
          />
          <button
            onClick={handleSearch}
            className="flex items-center justify-center gap-2 px-4 bg-slate-900 text-white rounded-r hover:bg-slate-800 transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <p>Carregando produtos...</p>
      ) : filteredProducts.length === 0 ? (
        <p>Nenhum produto encontrado.</p>
      ) : (
        <div className="px-4 sm:px-8 md:px-16 lg:px-24 xl:px-32 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pt-12">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="w-full bg-background border border-gray-200 rounded-lg shadow-sm flex flex-col"
            >
              <div className="h-[250px] flex items-center justify-center p-4">
                <Image
                  className="rounded-lg object-contain max-h-full w-auto"
                  width={160}
                  height={200}
                  src={product.image || "/placeholder.svg"}
                  alt="Imagem do produto"
                />
              </div>
              <div className="px-5 pb-5 flex-1 flex flex-col">
                <div className="flex-1">
                  <h5
                    className="text-gray-800 text-xl font-semibold tracking-tight cursor-pointer hover:text-slate-600"
                    onClick={() => handleProductClick(product)}
                  >
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
                      onClick={(e) =>
                        handleAddToCart(product.id, e.currentTarget)
                      }
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
      {modalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full relative p-6">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-red-600 text-2xl"
              onClick={closeModal}
              aria-label="Fechar"
            >
              &times;
            </button>
            <ProductOverview {...selectedProduct} />
          </div>
        </div>
      )}
      {showSuccess && successPosition && (
        <SuccessPopup
          message="Product added to cart!"
          onClose={() => setShowSuccess(false)}
          style={{
            position: "fixed",
            top: successPosition.top,
            left: successPosition.left,
            transform: "translate(-50%, -50%)", // centraliza acima do botão
            zIndex: 9999,
          }}
        />
      )}
    </div>
  );
}
