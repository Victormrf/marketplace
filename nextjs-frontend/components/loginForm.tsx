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
import { useAuth } from "@/context/authContext";
import { ApiError } from "@/lib/http";
import { login } from "@/services/auth";
import { getCurrentUser } from "@/services/user";
import { getMySellerProfile } from "@/services/seller";

type LoginFormProps = {
  onRegisterClick?: () => void;
  onClose?: () => void;
  onAuthSuccess?: () => void;
  returnTo?: string;
};

export default function LoginForm({
  onRegisterClick,
  onClose,
  onAuthSuccess,
  returnTo,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { setUser } = useAuth();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ email, password });
      const user = await getCurrentUser();
      setUser(user);
      onAuthSuccess?.();
      onClose?.();
      router.refresh();

      if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        router.push(returnTo);
      } else if (user.role === "SELLER") {
        const seller = await getMySellerProfile();
        router.push(`/store/${seller.id}`);
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setError("E-mail ou senha inválidos.");
      } else if (cause instanceof ApiError && cause.status === 403) {
        setError("Sua conta não tem permissão para esta operação.");
      } else {
        setError("Não foi possível entrar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="relative w-full max-w-md">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 text-xl text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            ×
          </button>
        )}
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Entrar</CardTitle>
          <CardDescription>Digite suas credenciais para acessar sua conta</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="text-sm text-red-500">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            <div className="text-center text-sm">
              Não possui uma conta?{" "}
              <button
                type="button"
                className="text-primary underline underline-offset-4"
                onClick={onRegisterClick}
              >
                Registre-se
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
