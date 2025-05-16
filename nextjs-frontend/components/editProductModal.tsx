"use client";

import type React from "react";

import { useState } from "react";
import Image from "next/image";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Edit, Save, X } from "lucide-react";

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

// Categorias de exemplo
const CATEGORIES = [
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

interface ProductModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (product: Product) => void;
}

export function ProductModal({
  product,
  isOpen,
  onClose,
  onUpdate,
}: ProductModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState<Product>({ ...product });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Formatar a data de criação
  const formattedDate = new Date(product.createdAt).toLocaleDateString(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  );

  // Alternar entre modo de visualização e edição
  const toggleEditMode = () => {
    if (isEditing) {
      // Cancelar edição
      setEditedProduct({ ...product });
      setImagePreview(null);
    }
    setIsEditing(!isEditing);
  };

  // Atualizar campos do produto
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditedProduct((prev) => ({
      ...prev,
      [name]: name === "price" || name === "stock" ? Number(value) : value,
    }));
  };

  // Atualizar categoria
  const handleCategoryChange = (value: string) => {
    setEditedProduct((prev) => ({
      ...prev,
      category: value,
    }));
  };

  // Lidar com upload de imagem
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Criar preview da imagem
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Em um cenário real, você faria upload da imagem para um serviço
      // e atualizaria a URL no produto
      // Por enquanto, apenas simulamos isso
      setEditedProduct((prev) => ({
        ...prev,
        image: URL.createObjectURL(file), // Isso é temporário e só funciona para preview
      }));
    }
  };

  // Salvar alterações
  const handleSave = () => {
    onUpdate(editedProduct);
    setIsEditing(false);
  };

  // Determinar o status do estoque
  const getStockStatus = () => {
    const stock = isEditing ? editedProduct.stock : product.stock;

    if (stock <= 0)
      return { label: "Sem estoque", variant: "destructive" as const };
    if (stock < 5)
      return { label: "Estoque baixo", variant: "warning" as const };
    return { label: `${stock} em estoque`, variant: "outline" as const };
  };

  const stockStatus = getStockStatus();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pt-4 flex justify-between items-center">
            {isEditing ? "Editar Produto" : "Detalhes do Produto"}
            <div className="relative group">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleEditMode}
                className="h-12 w-12 rounded-full border border-solid hover:bg-gray-100"
              >
                {isEditing ? (
                  <X className="h-6 w-6 scale-125" />
                ) : (
                  <Edit className="h-6 w-6 scale-125" />
                )}
              </Button>
              <span className="absolute -bottom-8 right-0 scale-0 transition-all rounded bg-gray-800 p-2 text-xs text-white group-hover:scale-100">
                {isEditing ? "Cancelar edição" : "Editar produto"}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Imagem do Produto */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-md overflow-hidden border">
              <Image
                src={imagePreview || editedProduct.image || "/placeholder.svg"}
                alt={editedProduct.name}
                fill
                className="object-cover"
              />
            </div>

            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="image">Alterar Imagem</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Detalhes do Produto */}
          <div className="flex flex-col h-full">
            <div className="flex-grow space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Produto</Label>
                    <Input
                      id="name"
                      name="name"
                      value={editedProduct.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={editedProduct.description || ""}
                      onChange={handleChange}
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Preço (R$)</Label>
                      <Input
                        id="price"
                        name="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={editedProduct.price}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stock">Estoque</Label>
                      <Input
                        id="stock"
                        name="stock"
                        type="number"
                        min="0"
                        step="1"
                        value={editedProduct.stock}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select
                      value={editedProduct.category}
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Selecione uma categoria" />
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
                </>
              ) : (
                <>
                  <div>
                    <h2 className="text-2xl font-bold">{product.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge>{product.category}</Badge>
                      <Badge variant={stockStatus.variant}>
                        {stockStatus.label}
                      </Badge>
                    </div>
                  </div>

                  <div className="text-3xl font-bold">
                    {formatCurrency(product.price)}
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Descrição
                    </h3>
                    <p className="text-sm">
                      {product.description || "Sem descrição disponível."}
                    </p>
                  </div>
                </>
              )}
            </div>
            {/* Product details at bottom */}
            {isEditing || (
              <div className="grid grid-cols-2 gap-4 text-sm mt-auto pt-4 ">
                <div>
                  <h3 className="font-medium text-muted-foreground mb-1">
                    ID do Produto
                  </h3>
                  <p className="font-mono">{product.id}</p>
                </div>
                <div>
                  <h3 className="font-medium text-muted-foreground mb-1">
                    Data de Criação
                  </h3>
                  <p>{formattedDate}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {isEditing ? (
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Salvar Alterações
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
