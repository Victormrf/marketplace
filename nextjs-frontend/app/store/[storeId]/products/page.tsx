// listagem de produtos
"use client";

import { useState, useEffect } from "react";
import { Search, Plus } from "lucide-react";
import Link from "next/link";
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
import { ProductModal } from "@/components/productModal";
import { toast } from "@/hooks/use-toast";

// Tipos baseados no modelo fornecido
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

// Categorias de exemplo
const CATEGORIES = [
  "Todos",
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

// Produtos de exemplo
const MOCK_PRODUCTS: Product[] = [
  {
    id: "1",
    sellerId: "seller1",
    name: "Smartphone Galaxy S23",
    description:
      "Smartphone Samsung Galaxy S23 com 256GB de armazenamento e 8GB de RAM.",
    price: 4999.99,
    stock: 15,
    category: "Eletrônicos",
    image: "/placeholder.svg",
    createdAt: new Date("2023-10-15"),
  },
  {
    id: "2",
    sellerId: "seller1",
    name: "Notebook Dell Inspiron",
    description:
      "Notebook Dell Inspiron com processador Intel i7, 16GB de RAM e SSD de 512GB.",
    price: 5499.99,
    stock: 8,
    category: "Eletrônicos",
    image: "/placeholder.svg",
    createdAt: new Date("2023-09-20"),
  },
  {
    id: "3",
    sellerId: "seller1",
    name: "Camiseta Básica",
    description: "Camiseta básica 100% algodão, disponível em várias cores.",
    price: 59.9,
    stock: 100,
    category: "Roupas",
    image: "/placeholder.svg",
    createdAt: new Date("2023-11-05"),
  },
  {
    id: "4",
    sellerId: "seller1",
    name: "Tênis Esportivo",
    description:
      "Tênis esportivo para corrida e caminhada, com amortecimento e suporte.",
    price: 299.9,
    stock: 25,
    category: "Esportes",
    image: "/placeholder.svg",
    createdAt: new Date("2023-10-25"),
  },
  {
    id: "5",
    sellerId: "seller1",
    name: "Fone de Ouvido Bluetooth",
    description:
      "Fone de ouvido sem fio com cancelamento de ruído e bateria de longa duração.",
    price: 349.9,
    stock: 30,
    category: "Eletrônicos",
    image: "/placeholder.svg",
    createdAt: new Date("2023-11-10"),
  },
  {
    id: "6",
    sellerId: "seller1",
    name: "Livro - O Senhor dos Anéis",
    description: "Edição completa da trilogia O Senhor dos Anéis, capa dura.",
    price: 149.9,
    stock: 12,
    category: "Livros",
    image: "/placeholder.svg",
    createdAt: new Date("2023-09-15"),
  },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [filteredProducts, setFilteredProducts] =
    useState<Product[]>(MOCK_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filtrar produtos quando a busca ou categoria mudar
  useEffect(() => {
    let filtered = [...products];

    // Filtrar por busca
    if (searchQuery) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filtrar por categoria
    if (selectedCategory !== "Todos") {
      filtered = filtered.filter(
        (product) => product.category === selectedCategory
      );
    }

    setFilteredProducts(filtered);
  }, [searchQuery, selectedCategory, products]);

  // Função para abrir o modal com o produto selecionado
  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  // Função para atualizar um produto
  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts((prevProducts) =>
      prevProducts.map((product) =>
        product.id === updatedProduct.id ? updatedProduct : product
      )
    );

    toast({
      title: "Produto atualizado",
      description: "As informações do produto foram atualizadas com sucesso.",
    });

    setIsModalOpen(false);
  };

  return (
    <div className="container py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold">Produtos</h1>
          <Link href="/dashboard/products/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar produtos..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
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

        {filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <p className="text-muted-foreground mb-4">
                Nenhum produto encontrado.
              </p>
              <Link href="/dashboard/products/new">
                <Button variant="outline">Adicionar Produto</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
    </div>
  );
}
