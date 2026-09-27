"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { formatCurrency } from "@/lib/utils";
import { ApiError } from "@/lib/http";
import { updateProduct, type ProductCategory } from "@/services/catalog";
import type { ProductReadDto } from "@/types/product";
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

const CATEGORIES: ProductCategory[] = [
  "OFFICE",
  "SPORTS",
  "BOOKS",
  "BEAUTY",
  "CLOTHING",
  "TOYS",
  "TV_PROJECTORS",
  "SMARTPHONES_TABLETS",
  "ELECTRONICS",
  "PETS",
  "FURNITURE",
];

interface ProductModalProps {
  product: ProductReadDto;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (product: ProductReadDto) => void;
}

export function ProductModal({
  product,
  isOpen,
  onClose,
  onUpdate,
}: ProductModalProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(product.name);
  const [reference, setReference] = useState(product.reference ?? "");
  const [description, setDescription] = useState(product.description ?? "");
  const [price, setPrice] = useState((product.priceInCents / 100).toFixed(2));
  const [category, setCategory] = useState<ProductCategory>(product.category as ProductCategory);
  const [image, setImage] = useState<File | undefined>();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(product.name);
    setReference(product.reference ?? "");
    setDescription(product.description ?? "");
    setPrice((product.priceInCents / 100).toFixed(2));
    setCategory(product.category as ProductCategory);
    setImage(undefined);
    setImagePreview(null);
    setEditing(false);
    setError(null);
  }, [product]);

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const updated = await updateProduct(product.id, {
        name,
        reference: reference.trim() || null,
        description: description.trim() || null,
        priceInCents: Math.round(Number(price) * 100),
        currency: product.currency,
        category,
        ...(image ? { image } : {}),
      });
      onUpdate(updated);
      setEditing(false);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Não foi possível atualizar o produto.",
      );
    } finally {
      setSaving(false);
    }
  }

  function selectImage(file?: File) {
    setImage(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  const imageSource = imagePreview || product.image || "/placeholder.svg";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar produto" : "Detalhes do produto"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-md border">
              <Image src={imageSource} alt={name} fill className="object-cover" />
            </div>
            {editing && (
              <div className="space-y-2">
                <Label htmlFor="product-image">Imagem</Label>
                <Input
                  id="product-image"
                  type="file"
                  accept="image/*"
                  onChange={(event) => selectImage(event.target.files?.[0])}
                />
              </div>
            )}
          </div>
          <div className="space-y-4">
            {editing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="product-name">Nome</Label>
                  <Input id="product-name" value={name} onChange={(event) => setName(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-reference">Referência</Label>
                  <Input
                    id="product-reference"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-description">Descrição</Label>
                  <Textarea
                    id="product-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-price">Preço (R$)</Label>
                  <Input
                    id="product-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-category">Categoria</Label>
                  <Select value={category} onValueChange={(value) => setCategory(value as ProductCategory)}>
                    <SelectTrigger id="product-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((value) => (
                        <SelectItem key={value} value={value}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-2xl font-bold">{product.name}</h2>
                  <p className="text-sm text-muted-foreground">{product.sellerName} · {product.category}</p>
                </div>
                <p className="text-3xl font-bold">{formatCurrency(product.priceInCents / 100)}</p>
                <p className={product.isAvailable ? "text-green-700" : "text-red-700"}>
                  {product.isAvailable ? "Disponível" : "Indisponível"}
                </p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt>Estoque físico</dt><dd>{product.inventory.onHandQuantity}</dd>
                  <dt>Reservado</dt><dd>{product.inventory.reservedQuantity}</dd>
                  <dt>Disponível para venda</dt><dd>{product.inventory.availableQuantity}</dd>
                  <dt>Referência</dt><dd>{product.reference || "—"}</dd>
                </dl>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Descrição</h3>
                  <p className="text-sm">{product.description || "Sem descrição."}</p>
                </div>
              </>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          {editing ? (
            <>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
              <Button type="button" onClick={() => setEditing(true)}>Editar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
