"use client";

import type React from "react";

import { useState } from "react";
import { Save, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";

// Enums e tipos baseados no modelo fornecido
export enum UserRole {
  CUSTOMER = "CUSTOMER",
  SELLER = "SELLER",
}

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
};

export type Customer = {
  id: string;
  userId: string;
  address: string;
  phone: string;
};

export type Seller = {
  id: string;
  userId: string;
  storeName: string;
  logo?: string;
  description?: string;
  rating: number;
};

export type UserProfile = {
  user: User;
  customer?: Customer;
  seller?: Seller;
};

export default function EditProfilePage({
  userProfile,
  onSuccess,
}: {
  userProfile: UserProfile | null;
  onSuccess: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    // Dados do usuário
    name: userProfile?.user.name || "",
    email: userProfile?.user.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    // Dados do customer
    address: userProfile?.customer?.address || "",
    phone: userProfile?.customer?.phone || "",
    // Dados do seller
    storeName: userProfile?.seller?.storeName || "",
    description: userProfile?.seller?.description || "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);

      // Criar preview da imagem
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Preparar dados do usuário (apenas campos preenchidos)
      const userUpdate: Partial<{ name: string; email: string }> = {};
      if (formData.name !== userProfile?.user.name)
        userUpdate.name = formData.name;
      if (formData.email !== userProfile?.user.email)
        userUpdate.email = formData.email;

      // Atualizar usuário se houver mudanças
      if (Object.keys(userUpdate).length > 0) {
        const userRes = await fetch("http://localhost:8000/users/", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(userUpdate),
        });
        if (!userRes.ok) throw new Error("Failed to update user data");
      }

      // Atualizar customer se for customer e houver mudanças
      if (userProfile?.customer) {
        const customerUpdate: Partial<{ address: string; phone: string }> = {};
        if (formData.address !== userProfile.customer.address)
          customerUpdate.address = formData.address;
        if (formData.phone !== userProfile.customer.phone)
          customerUpdate.phone = formData.phone;

        if (Object.keys(customerUpdate).length > 0) {
          const customerRes = await fetch("http://localhost:8000/customers/", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(customerUpdate),
          });
          if (!customerRes.ok)
            throw new Error("Failed to update customer data");
        }
      }

      // Atualizar seller se for seller e houver mudanças
      if (userProfile?.seller) {
        const sellerUpdate: Partial<{
          storeName: string;
          description: string;
          logo: string;
        }> = {};

        if (formData.storeName !== userProfile.seller.storeName)
          sellerUpdate.storeName = formData.storeName;
        if (formData.description !== userProfile.seller.description)
          sellerUpdate.description = formData.description;
        if (logoFile) {
          // Aqui você implementaria o upload do logo
          // const logoUrl = await uploadLogo(logoFile);
          // sellerUpdate.logo = logoUrl;
        }

        if (Object.keys(sellerUpdate).length > 0) {
          const sellerRes = await fetch("http://localhost:8000/sellers/", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(sellerUpdate),
          });
          if (!sellerRes.ok) throw new Error("Failed to update seller data");
        }
      }

      toast({
        title: "Profile updated!",
        description: "Your information has been updated successfully.",
      });

      onSuccess();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error updating profile",
        description:
          "An error occurred while updating your information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!userProfile) {
    return <div>Carregando...</div>;
  }

  const isCustomer = userProfile.user.role === UserRole.CUSTOMER;
  const isSeller = userProfile.user.role === UserRole.SELLER;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="py-2">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="space-y-6">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Alterar Senha */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Change Password</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type={showPassword ? "text" : "password"}
                        value={formData.newPassword}
                        onChange={handleChange}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Confirm new password
                    </Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Informações Específicas do Customer */}
            {isCustomer && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Delivery Information</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Street, number, district, city, zipcode"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Informações Específicas do Seller */}
            {isSeller && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Store Information</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="storeName">Store Name</Label>
                    <Input
                      id="storeName"
                      name="storeName"
                      value={formData.storeName}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Store description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Describe your store and products"
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logo">Store logo</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <Input
                        id="logo"
                        name="logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="cursor-pointer"
                      />
                      {(logoPreview || userProfile.seller?.logo) && (
                        <div className="relative aspect-square w-full max-w-[120px] overflow-hidden rounded-md border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              logoPreview ||
                              userProfile.seller?.logo ||
                              "/placeholder.svg"
                            }
                            alt="Logo da loja"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Botões de Ação */}
            <div className="flex justify-end gap-4">
              <Link href="/profile">
                <Button variant="outline" type="button">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  "Salvando..."
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
