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
import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  id: string;
  email: string;
  role: "customer" | "seller" | "admin";
}

type LoginFormProps = {
  onRegisterClick?: () => void;
  onClose?: () => void;
};

export default function LoginForm({
  onRegisterClick,
  onClose,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Função para sincronizar o carrinho local com o backend
  async function syncLocalCartWithBackend(token: string) {
    const localCart = JSON.parse(localStorage.getItem("cart") || "[]");
    for (const item of localCart) {
      await fetch("http://localhost:8000/cart-items/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
      const res = await fetch("http://localhost:8000/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError("Usuário ou senha inválidos");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const token = data.token; // ajuste conforme resposta do seu backend

      // 2. Salve o token (exemplo: localStorage, cookie, context, etc)
      localStorage.setItem("token", token);

      // 3. Decodifique o token para recuperar a role do usuário logado.
      const decoded = jwtDecode<DecodedToken>(token);

      // 3. Sincronize o carrinho local com o backend, apenas caso o usuário logado seja um customer
      if (decoded.role === "customer") {
        await syncLocalCartWithBackend(token);
      }

      // 4. Feche o modal ou redirecione
      if (onClose) onClose();
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
