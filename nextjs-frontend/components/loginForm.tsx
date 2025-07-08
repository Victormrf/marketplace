import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

type LoginFormProps = {
  onRegisterClick?: () => void;
  onClose?: () => void;
  onAuthSuccess?: () => void;
};

export default function LoginForm({
  onRegisterClick,
  onClose,
  onAuthSuccess,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Função para sincronizar o carrinho local com o backend
  async function syncLocalCartWithBackend() {
    const localCart = JSON.parse(localStorage.getItem("cart") || "[]");
    for (const item of localCart) {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cart-items/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Não precisa mais do Authorization
        },
        credentials: "include", // <<< ESSENCIAL
        body: JSON.stringify(item),
      });
    }
    localStorage.removeItem("cart");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Autenticação
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        }
      );

      if (!res.ok) {
        setError("Usuário ou senha inválidos");
        setLoading(false);
        return;
      }

      // 2. Recuperação de dados do usuário
      const userRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/me`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!userRes.ok) {
        throw new Error("Erro ao obter dados do usuário");
      }

      const user = await userRes.json();

      // 3. Sincroniza o carrinho local com o backend se o usuário for customer
      if (user.role === "CUSTOMER") {
        await syncLocalCartWithBackend();
      }

      // 4. Redirecionamento para seller
      if (user.role === "SELLER") {
        const sellerRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/sellers/`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!sellerRes.ok) {
          throw new Error("Erro ao obter dados do seller");
        }

        const sellerData = await sellerRes.json();
        const sellerId = sellerData.profile.id;

        // Primeiro atualizamos o header
        onAuthSuccess?.();

        // Pequeno delay para garantir que o estado foi atualizado
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Depois fechamos o modal e navegamos
        if (onClose) onClose();
        await router.push(`/store/${sellerId}`);
        return;
      }

      // 5. Fecha o modal ou redireciona
      onAuthSuccess?.();
      if (onClose) onClose();
      router.refresh();
    } catch (err: unknown) {
      setError(
        `Erro ao fazer login. Tente novamente. ${
          err instanceof Error ? err.message : "Erro desconhecido"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-md relative">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xl"
            aria-label="Fechar"
          >
            ×
          </button>
        )}
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Entrar</CardTitle>
          <CardDescription>
            Digite suas credenciais para acessar sua conta
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label
                htmlFor="remember"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Lembrar de mim
              </Label>
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
                className="text-primary underline underline-offset-4 hover:text-primary/90"
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
