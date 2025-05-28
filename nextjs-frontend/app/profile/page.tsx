"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Edit, Mail, Calendar, Star, MapPin, Phone, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

// Dados de exemplo - mesmo do formulário de edição
const MOCK_USER_PROFILE: UserProfile = {
  user: {
    id: "user-123",
    name: "João Silva",
    email: "joao.silva@email.com",
    password: "hashedpassword",
    role: "SELLER" as UserRole,
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

export default function ProfilePage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function fetchUserProfile() {
      // try {
      const res = await fetch("http://localhost:8000/users/me", {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error fetching user");
      const userData = await res.json();

      if (userData.role === "CUSTOMER") {
        const customerRes = await fetch("http://localhost:8000/customers/", {
          method: "GET",
          credentials: "include",
        });
        if (!customerRes.ok) throw new Error("Error fetching customer profile");
        const customerData = await customerRes.json();

        console.log({
          user: userData,
          customer: customerData.profile,
        });

        setUserProfile({
          user: userData,
          customer: customerData.profile,
        });
      } else {
        const sellerRes = await fetch("http://localhost:8000/sellers/", {
          method: "GET",
          credentials: "include",
        });
        if (!sellerRes.ok) throw new Error("Error fetching customer profile");
        const sellerData = await sellerRes.json();

        setUserProfile({
          user: userData,
          seller: sellerData.profile,
        });
      }
      // } catch (error) {
      //   console.error(error);
      // }
    }
    fetchUserProfile();
    setUserProfile(MOCK_USER_PROFILE);
  }, []);

  if (!userProfile) {
    return <div>Carregando...</div>;
  }

  const isCustomer = userProfile.user.role === "CUSTOMER";
  const isSeller = userProfile.user.role === "SELLER";

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="container py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Meu Perfil</h1>
          <Link href="/profile/edit">
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Editar Perfil
            </Button>
          </Link>
        </div>

        {/* Informações Básicas */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  src={isSeller ? userProfile.seller?.logo : undefined}
                />
                <AvatarFallback className="text-lg">
                  {userProfile.user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl">
                  {userProfile.user.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {userProfile.user.email}
                </CardDescription>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">
                    {isSeller ? "Vendedor" : "Cliente"}
                  </Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Membro desde {formatDate(userProfile.user.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Informações do Customer */}
        {isCustomer && userProfile.customer && (
          <Card>
            <CardHeader>
              <CardTitle>Informações de Entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Endereço</p>
                  <p className="text-muted-foreground">
                    {userProfile.customer.address || "Não informado"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Telefone</p>
                  <p className="text-muted-foreground">
                    {userProfile.customer.phone || "Não informado"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Informações do Seller */}
        {isSeller && userProfile.seller && (
          <Card>
            <CardHeader>
              <CardTitle>Informações da Loja</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Nome da Loja</p>
                  <p className="text-muted-foreground">
                    {userProfile.seller.storeName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Avaliação</p>
                  <p className="text-muted-foreground">
                    {userProfile.seller.rating.toFixed(1)} estrelas
                  </p>
                </div>
              </div>
              {userProfile.seller.description && (
                <div>
                  <p className="font-medium mb-2">Descrição</p>
                  <p className="text-muted-foreground">
                    {userProfile.seller.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
