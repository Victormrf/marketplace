"use client";

import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type RegisterFormProps = {
  onBackToLogin?: () => void;
  onClose?: () => void;
  onAuthSuccess?: () => void;
};

export default function RegisterForm({
  onBackToLogin,
  onClose,
  onAuthSuccess,
}: RegisterFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState<"customer" | "seller" | "">("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    address: "",
    phone: "",
    companyName: "",
    companyDescription: "",
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);

      // Create image preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Erro de validação",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // 1. Register user
      const registerRes = await fetch("http://localhost:8000/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: userType.toUpperCase(),
        }),
      });

      if (!registerRes.ok) {
        throw new Error("Falha ao registrar usuário");
      }

      // 2. Login with new account to get JWT
      const loginRes = await fetch("http://localhost:8000/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      if (!loginRes.ok) {
        throw new Error("Falha ao realizar login");
      }

      // 3. Create profile based on user type
      if (userType === "customer") {
        const customerRes = await fetch("http://localhost:8000/customers/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            address: formData.address,
            phone: formData.phone,
          }),
        });

        if (!customerRes.ok) {
          throw new Error("Falha ao criar perfil do cliente");
        }
      } else if (userType === "seller") {
        // Create FormData for multipart/form-data request
        const formDataObj = new FormData();
        formDataObj.append("storeName", formData.companyName);
        formDataObj.append("description", formData.companyDescription);

        // Append logo file if it exists
        if (logoFile) {
          formDataObj.append("logo", logoFile);
        }

        const sellerRes = await fetch("http://localhost:8000/sellers/", {
          method: "POST",
          credentials: "include",
          // Remove Content-Type header to let browser set it with boundary
          body: formDataObj,
        });

        if (!sellerRes.ok) {
          const errorData = await sellerRes.json().catch(() => ({}));
          throw new Error(
            errorData.detail || "Falha ao criar perfil do vendedor"
          );
        }
      }

      // Success - notify parent components and close modal
      toast({
        title: "Conta criada com sucesso!",
        description: "Você já está logado no sistema.",
      });

      onAuthSuccess?.();
      onClose?.();

      // Redirect based on user type
      if (userType === "seller") {
        const sellerData = await fetch("http://localhost:8000/sellers/", {
          credentials: "include",
        }).then((res) => res.json());
        router.push(`/store/${sellerData.profile.id}`);
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Erro no registro",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-md">
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
          <CardTitle className="text-2xl font-bold">Criar conta</CardTitle>
          <CardDescription>
            Escolha o tipo de conta e preencha os dados
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Seleção de tipo */}
            <div className="space-y-2">
              <Label htmlFor="userType">Tipo de conta</Label>
              <RadioGroup
                defaultValue=""
                onValueChange={(val: "customer" | "seller") => setUserType(val)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="customer" id="customer" />
                  <Label htmlFor="customer">Cliente</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="seller" id="seller" />
                  <Label htmlFor="seller">Vendedor</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Campos dinâmicos */}
            {userType === "customer" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    name="name"
                    id="name"
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    type="email"
                    name="email"
                    id="email"
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    type="password"
                    name="password"
                    id="password"
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <Input
                    type="password"
                    name="confirmPassword"
                    id="confirmPassword"
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    name="address"
                    id="address"
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    name="phone"
                    id="phone"
                    onChange={handleChange}
                    required
                  />
                </div>
              </>
            )}

            {userType === "seller" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do responsável</Label>
                  <Input
                    name="name"
                    id="name"
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    type="email"
                    name="email"
                    id="email"
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nome da empresa</Label>
                  <Input
                    name="companyName"
                    id="companyName"
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    type="password"
                    name="password"
                    id="password"
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <Input
                    type="password"
                    name="confirmPassword"
                    id="confirmPassword"
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyDescription">
                    Descrição da empresa
                  </Label>
                  <textarea
                    name="companyDescription"
                    id="companyDescription"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    rows={3}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo">Logo da Empresa</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <Input
                      id="logo"
                      name="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="cursor-pointer"
                    />
                    {logoPreview && (
                      <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-md border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoPreview}
                          alt="Logo Preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={!userType || isLoading}
            >
              {isLoading ? "Registrando..." : "Registrar"}
            </Button>
            <div className="text-center text-sm">
              Já possui uma conta?{" "}
              <button
                type="button"
                className="text-primary underline underline-offset-4 hover:text-primary/90"
                onClick={onBackToLogin}
              >
                Entrar
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
