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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/context/authContext";
import { ApiError } from "@/lib/http";
import { login, register } from "@/services/auth";
import { createMyCustomerProfile } from "@/services/customer";
import { createMySellerProfile, getMySellerProfile } from "@/services/seller";
import { getCurrentUser } from "@/services/user";
import type { UserRole } from "@/types/auth";

type RegisterFormProps = {
  onBackToLogin?: () => void;
  onClose?: () => void;
  onAuthSuccess?: () => void;
};

type RegistrationRole = Exclude<UserRole, "ADMIN">;

export default function RegisterForm({
  onBackToLogin,
  onClose,
  onAuthSuccess,
}: RegisterFormProps) {
  const router = useRouter();
  const { setUser } = useAuth();
  const [role, setRole] = useState<RegistrationRole | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!role) return;
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setError(null);
    let accountCreated = false;

    try {
      await register({ name, email, password, role });
      accountCreated = true;
      await login({ email, password });

      if (role === "CUSTOMER") {
        await createMyCustomerProfile({ phone: phone || null });
      } else {
        await createMySellerProfile({ storeName, description });
      }

      const user = await getCurrentUser();
      setUser(user);
      onAuthSuccess?.();
      onClose?.();
      router.refresh();

      if (role === "SELLER") {
        const seller = await getMySellerProfile();
        router.push(`/store/${seller.id}`);
      } else {
        router.push("/");
      }
    } catch (cause) {
      const message =
        cause instanceof ApiError ? cause.message : "Tente novamente.";
      setError(
        accountCreated
          ? `A conta foi criada, mas a configuração do perfil não terminou. ${message}`
          : message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Criar conta</CardTitle>
          <CardDescription>Escolha o tipo de conta e preencha seus dados.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <RadioGroup
              value={role}
              onValueChange={(value) => setRole(value as RegistrationRole)}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="CUSTOMER" id="customer-role" />
                <Label htmlFor="customer-role">Cliente</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="SELLER" id="seller-role" />
                <Label htmlFor="seller-role">Vendedor</Label>
              </div>
            </RadioGroup>
            <div className="space-y-2">
              <Label htmlFor="register-name">Nome</Label>
              <Input
                id="register-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-email">E-mail</Label>
              <Input
                id="register-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Senha</Label>
              <Input
                id="register-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-confirm-password">Confirmar senha</Label>
              <Input
                id="register-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>
            {role === "CUSTOMER" && (
              <div className="space-y-2">
                <Label htmlFor="register-phone">Telefone (opcional)</Label>
                <Input
                  id="register-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            )}
            {role === "SELLER" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="register-store">Nome da loja</Label>
                  <Input
                    id="register-store"
                    value={storeName}
                    onChange={(event) => setStoreName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-description">Descrição</Label>
                  <textarea
                    id="register-description"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={!role || loading}>
              {loading ? "Registrando..." : "Registrar"}
            </Button>
            <div className="text-center text-sm">
              Já possui uma conta?{" "}
              <button type="button" className="text-primary underline" onClick={onBackToLogin}>
                Entrar
              </button>
              {onClose && (
                <button
                  type="button"
                  className="ml-3 underline"
                  onClick={onClose}
                >
                  Fechar
                </button>
              )}
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
