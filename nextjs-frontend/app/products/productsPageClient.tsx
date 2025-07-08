"use client";

import { Search, ChevronLeft, ArrowUpDown, Heart } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ProductOverview from "@/components/productOverview";
import SuccessPopup from "@/components/popups/successPopup";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Product } from "@/types/product";

type SortOption = "name" | "price-asc" | "price-desc" | "rating";

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const searchInput = searchParams.get("search");
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
  const [sortBy, setSortBy] = useState<SortOption>("name");

  // Função para adicionar ao carrinho
  async function handleAddToCart(
    productId: string,
    btnElement: HTMLButtonElement
  ) {
    try {
      // Verifica se existe um usuário logado usando a rota /me
      const userRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/me`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (userRes.ok) {
        // Usuário está logado, adiciona no backend
        const addToCartRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/cart-items`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              productId,
              quantity: 1,
            }),
          }
        );

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
    const fetchProducts = async () => {
      try {
        let url = `${process.env.NEXT_PUBLIC_API_URL}/products`;

        // Se tiver categoria, busca por categoria
        if (category) {
          url = `${process.env.NEXT_PUBLIC_API_URL}/products/category/${category}`;
        }
        // Se tiver termo de busca, usa o endpoint de busca
        else if (searchInput) {
          url = `${
            process.env.NEXT_PUBLIC_API_URL
          }/products/search?q=${encodeURIComponent(searchInput)}`;
        }

        const res = await fetch(url);
        const data = await res.json();
        const productsList = Array.isArray(data.products) ? data.products : [];
        setProducts(productsList);
        setFilteredProducts(productsList);
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [category, searchInput]);

  const sortProducts = (products: Product[], sortBy: SortOption) => {
    const sorted = [...products];
    switch (sortBy) {
      case "name":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "price-asc":
        return sorted.sort((a, b) => a.price - b.price);
      case "price-desc":
        return sorted.sort((a, b) => b.price - a.price);
      case "rating":
        return sorted.sort(
          (a, b) => (b.averageRating || 0) - (a.averageRating || 0)
        );
      default:
        return sorted;
    }
  };

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
      {/* Breadcrumb Navigation */}
      <div className="bg-gray-100 px-4 py-2 flex items-center text-sm text-gray-600">
        <Link
          href="/"
          className="flex items-center hover:text-gray-900 hover:underline"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 hover:underline hover:cursor-pointer">
          {category
            ? `${category} Products`
            : `Search results for "${searchInput}"`}
        </span>
      </div>

      {/* Header Section */}
      <div className="bg-white border-b shadow-sm">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold mb-2">
            {category
              ? `${category} Products`
              : `Search results for "${searchInput}"`}
          </h1>

          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search products..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setSortBy("name")}>
                  Name (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("price-asc")}>
                  Price (Low to High)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("price-desc")}>
                  Price (High to Low)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("rating")}>
                  Best Rated
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Carregando produtos...</p>
      ) : filteredProducts.length === 0 ? (
        <p>Nenhum produto encontrado.</p>
      ) : (
        <div className="px-4 sm:px-8 md:px-16 lg:px-24 xl:px-32 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pt-12">
          {sortProducts(filteredProducts, sortBy).map((product) => (
            <div
              key={product.id}
              className="w-full bg-background border border-gray-200 rounded-lg shadow-sm flex flex-col cursor-pointer"
              onClick={() => handleProductClick(product)}
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
                  <h5 className="text-gray-800 text-xl font-semibold tracking-tight hover:text-slate-600">
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
                    {product?.seller?.storeName}
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
                      className="flex items-center justify-center text-white bg-slate-700 hover:bg-slate-900 font-medium rounded-lg text-sm px-4 py-2"
                      onClick={(e) =>
                        handleAddToCart(product.id, e.currentTarget)
                      }
                    >
                      <svg
                        className="w-5 h-5 -ms-2 me-2"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 4h1.5L8 16m0 0h8m-8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm.75-3H7.5M11 7H6.312M17 4v6m-3-3h6"
                        />
                      </svg>
                      Add to cart
                    </button>
                    <button className="text-slate-500 bg-white border border-slate-500 hover:border-slate-900 hover:text-slate-900 font-medium rounded-lg text-sm px-4 py-2">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
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
