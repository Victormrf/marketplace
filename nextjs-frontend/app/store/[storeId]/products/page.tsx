"use client";

import { useState, useEffect } from "react";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductCard } from "@/components/productCard";
import { ProductModal } from "@/components/editProductModal";
import { toast } from "@/hooks/use-toast";
import { NewProductModal } from "@/components/newProductModal";

export type Product = {
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

const CATEGORIES = [
  "All",
  "Eletrônicos",
  "Roupas",
  "Acessórios",
  "Casa e Decoração",
  "Esportes",
  "Livros",
  "Brinquedos",
  "Saúde e Beleza",
  "Alimentos",
  "Outros",
];

export default function ProductsPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);

  // Fetch dos produtos do seller
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const storeRes = await fetch("http://localhost:8000/sellers/", {
          method: "GET",
          credentials: "include",
        });

        if (!storeRes.ok) {
          throw new Error("Error fetching store data");
        }

        const store = await storeRes.json();
        setStoreId(store.profile.id);

        if (storeId) {
          const res = await fetch(
            `http://localhost:8000/products/seller/${storeId}`,
            {
              method: "GET",
              credentials: "include",
            }
          );

          const data = await res.json();
          setProducts(data.products);
        }
      } catch (error) {
        toast({
          title: "Erro",
          description: "Falha ao carregar os produtos do vendedor.",
          variant: "destructive",
        });
        console.error(error);
      }
    };

    fetchProducts();
  }, [storeId]);

  // Filtragem dinâmica
  useEffect(() => {
    let filtered = [...products];

    if (searchQuery) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== "All") {
      filtered = filtered.filter(
        (product) => product.category === selectedCategory
      );
    }

    setFilteredProducts(filtered);
  }, [searchQuery, selectedCategory, products]);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );

    toast({
      title: "Produto atualizado",
      description: "As informações do produto foram atualizadas com sucesso.",
    });

    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold">Your Products</h1>
            <Button onClick={() => setIsNewProductModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Product
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search products..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="px-8 py-8">
        {filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <p className="text-muted-foreground mb-4">No products found.</p>
              <Button
                onClick={() => setIsNewProductModalOpen(true)}
                variant="outline"
              >
                List your first product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => handleProductClick(product)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onUpdate={handleUpdateProduct}
        />
      )}

      <NewProductModal
        isOpen={isNewProductModalOpen}
        onClose={() => setIsNewProductModalOpen(false)}
      />
    </div>
  );
}
