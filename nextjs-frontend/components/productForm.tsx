"use client";

import type React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

// Categorias de exemplo - substitua pelas categorias reais do seu marketplace
const CATEGORIES = [
  "Office",
  "Sports",
  "Books",
  "Beauty",
  "Clothing",
  "Toys",
  "TvProjectors",
  "SmartphonesTablets",
  "Eletronics",
  "Pets",
  "Furniture",
];

interface ProductFormProps {
  onSuccess?: () => void;
}

export default function ProductForm({ onSuccess }: ProductFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    category: "",
    image: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);

      // Criar preview da imagem
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (
      !formData.name ||
      !formData.price ||
      !formData.stock ||
      !formData.category
    ) {
      toast({
        title: "Erro de validação",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const sellerDataRes = await fetch("http://localhost:8000/sellers/", {
        method: "GET",
        credentials: "include",
      });

      const seller = await sellerDataRes.json();
      const sellerId = seller.profile.id;

      const data = new FormData();
      data.append("sellerId", sellerId);
      data.append("name", formData.name);
      data.append("description", formData.description);
      data.append("price", formData.price);
      data.append("stock", formData.stock);
      data.append("category", formData.category);

      console.log(data);

      if (imageFile) {
        data.append("image", imageFile);
      }

      const productRes = await fetch("http://localhost:8000/products/", {
        method: "POST",
        body: data,
        credentials: "include",
      });

      if (!productRes.ok) {
        throw new Error("Falha ao criar produto");
      }

      toast({
        title: "Produto criado com sucesso!",
        description: "Seu produto foi adicionado ao marketplace.",
      });

      // Reset
      setFormData({
        name: "",
        description: "",
        price: "",
        stock: "",
        category: "",
        image: "",
      });
      setImageFile(null);
      setImagePreview(null);
      onSuccess?.();
    } catch (error) {
      console.error("Erro ao criar produto:", error);
      toast({
        title: "Erro ao criar produto",
        description:
          "Ocorreu um erro ao tentar criar o produto. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center">
      <Card className="">
        <CardHeader>
          <CardTitle>Cadastrar Novo Produto</CardTitle>
          <CardDescription>
            Preencha os detalhes do produto que você deseja vender no
            marketplace.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Produto *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Digite o nome do produto"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Descreva seu produto em detalhes"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$) *</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="0,00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stock">Estoque *</Label>
                  <Input
                    id="stock"
                    name="stock"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.stock}
                    onChange={handleChange}
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Select
                  value={formData.category}
                  onValueChange={handleCategoryChange}
                  required
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

              <div className="space-y-2">
                <Label htmlFor="image">Imagem do Produto</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <Input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="cursor-pointer"
                  />
                  {imagePreview && (
                    <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-md border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview || "/placeholder.svg"}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Cadastrar Produto"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
