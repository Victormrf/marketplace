"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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

// Dados de exemplo - em um cenário real, viriam da API
const MOCK_USER_PROFILE: UserProfile = {
  user: {
    id: "user-123",
    name: "João Silva",
    email: "joao.silva@email.com",
    password: "hashedpassword",
    role: UserRole.SELLER,
    createdAt: new Date("2023-06-15"),
  },
  seller: {
    id: "seller-456",
    userId: "user-123",
    storeName: "Loja do João",
    logo: "/placeholder.svg",
    description: "Especializada em eletrônicos e acessórios de qualidade.",
    rating: 4.8,
  },
};

export default function EditProfilePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    // Dados do usuário
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    // Dados do customer
    address: "",
    phone: "",
    // Dados do seller
    storeName: "",
    description: "",
  });

  // Carregar dados do usuário
  useEffect(() => {
    // Em um cenário real, você faria uma chamada à API aqui
    setUserProfile(MOCK_USER_PROFILE);
    setFormData({
      name: MOCK_USER_PROFILE.user.name,
      email: MOCK_USER_PROFILE.user.email,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      address: MOCK_USER_PROFILE.customer?.address || "",
      phone: MOCK_USER_PROFILE.customer?.phone || "",
      storeName: MOCK_USER_PROFILE.seller?.storeName || "",
      description: MOCK_USER_PROFILE.seller?.description || "",
    });
  }, []);

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

    // Validações básicas
    if (!formData.name || !formData.email) {
      toast({
        title: "Erro de validação",
        description: "Nome e email são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (
      formData.newPassword &&
      formData.newPassword !== formData.confirmPassword
    ) {
      toast({
        title: "Erro de validação",
        description: "A confirmação de senha não confere.",
        variant: "destructive",
      });
      return;
    }

    if (formData.newPassword && !formData.currentPassword) {
      toast({
        title: "Erro de validação",
        description:
          "Para alterar a senha, é necessário informar a senha atual.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Aqui você implementaria a lógica para atualizar o perfil
      let logoUrl = userProfile?.seller?.logo || "";
      if (logoFile) {
        // Exemplo de como seria o upload (pseudocódigo)
        // const uploadedLogo = await uploadLogo(logoFile)
        // logoUrl = uploadedLogo.url
        logoUrl = URL.createObjectURL(logoFile); // Placeholder
      }

      const updateData = {
        user: {
          name: formData.name,
          email: formData.email,
          ...(formData.newPassword && { password: formData.newPassword }),
        },
        ...(userProfile?.customer && {
          customer: {
            address: formData.address,
            phone: formData.phone,
          },
        }),
        ...(userProfile?.seller && {
          seller: {
            storeName: formData.storeName,
            description: formData.description,
            logo: logoUrl,
          },
        }),
      };

      // Chamada à API para atualizar o perfil
      // const response = await fetch('/api/profile', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(updateData)
      // })

      // if (!response.ok) throw new Error('Falha ao atualizar perfil')

      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram atualizadas com sucesso.",
      });

      console.log("Dados atualizados:", updateData);

      // Redirecionar para o perfil
      // router.push('/profile')
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast({
        title: "Erro ao atualizar perfil",
        description:
          "Ocorreu um erro ao tentar atualizar suas informações. Tente novamente.",
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
    <div className="container py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/profile">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Perfil
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Editar Perfil</CardTitle>
                <CardDescription>
                  Atualize suas informações pessoais e de conta
                </CardDescription>
              </div>
              <Badge variant="outline">
                {isSeller ? "Vendedor" : "Cliente"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Informações Básicas */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Informações Básicas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Alterar Senha */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Alterar Senha</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Senha Atual</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        name="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={formData.currentPassword}
                        onChange={handleChange}
                        placeholder="Digite sua senha atual para confirmar alterações"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() =>
                          setShowCurrentPassword(!showCurrentPassword)
                        }
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Nova Senha</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          name="newPassword"
                          type={showPassword ? "text" : "password"}
                          value={formData.newPassword}
                          onChange={handleChange}
                          placeholder="Deixe em branco para manter a atual"
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
                        Confirmar Nova Senha
                      </Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Confirme a nova senha"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Informações Específicas do Customer */}
              {isCustomer && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">
                    Informações de Entrega
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Endereço</Label>
                      <Textarea
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Rua, número, bairro, cidade, CEP"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
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
                  <h3 className="text-lg font-medium">Informações da Loja</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="storeName">Nome da Loja</Label>
                      <Input
                        id="storeName"
                        name="storeName"
                        value={formData.storeName}
                        onChange={handleChange}
                        placeholder="Nome da sua loja"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição da Loja</Label>
                      <Textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Descreva sua loja e produtos"
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logo">Logo da Loja</Label>
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
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
