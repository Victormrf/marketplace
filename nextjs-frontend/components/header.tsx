"use client";
import { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, User } from "lucide-react";
import { jwtDecode } from "jwt-decode";

interface DecodedData {
  id: string;
  email: string;
  role: "customer" | "seller" | "admin";
}

type UserRole = "customer" | "seller" | "admin" | null;

export default function Header({ onAuthClick }: { onAuthClick?: () => void }) {
  const [role, setRole] = useState<UserRole>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [rightSection, setRightSection] = useState<ReactNode>(null);

  useEffect(() => {
    // Verifica se há token no localStorage e decodifica a role
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      try {
        const decoded: DecodedData = jwtDecode(token);
        setRole(decoded.role || null);
      } catch {
        setRole(null);
      }
    } else {
      setRole(null);
    }
  }, []);

  useEffect(() => {
    if (!role) {
      setFeatures(["Home", "Best Sellers", "Gift Ideas", "Today’s Deals"]);
      setRightSection(
        <div className="relative flex items-center gap-4">
          {/* Carrinho */}
          <div className="relative">
            <Link
              href={"/cart"}
              className="inline-flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="hidden sm:inline">My Cart</span>
            </Link>
          </div>

          {/* Conta */}
          <button
            type="button"
            onClick={onAuthClick}
            className="inline-flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
          >
            <User className="w-5 h-5" />
            <span className="hidden sm:inline">Sign In / Register</span>
          </button>
        </div>
      );
    } else if (role === "customer") {
      setFeatures(["Home", "Pedidos", "Favoritos"]);
      setRightSection(
        <div className="relative flex items-center gap-4">
          {/* ...conteúdo para customer... */}
        </div>
      );
    } else if (role === "seller") {
      setFeatures(["Dashboard", "Produtos", "Vendas"]);
      setRightSection(
        <div className="relative flex items-center gap-4">
          {/* ...conteúdo para seller... */}
        </div>
      );
    } else if (role === "admin") {
      setFeatures(["Admin", "Usuários", "Relatórios"]);
      setRightSection(
        <div className="relative flex items-center gap-4">
          {/* ...conteúdo para admin... */}
        </div>
      );
    }
  }, [role, onAuthClick]);

  return (
    <nav className="bg-white dark:bg-gray-800 antialiased border-b border-gray-200 dark:border-gray-700">
      <div className="w-full px-6 md:px-10 py-4">
        <div className="flex items-center justify-between">
          {/* Lado esquerdo: logo + menu */}
          <div className="flex items-center gap-8">
            <Link href="/" className="shrink-0">
              <Image
                className="block dark:hidden"
                src="/v-market-logo.png"
                alt="Logo"
                width={80}
                height={80}
              />
              <Image
                className="hidden dark:block"
                src="https://flowbite.s3.amazonaws.com/blocks/e-commerce/logo-full-dark.svg"
                alt="Logo Dark"
                width={112}
                height={32}
              />
            </Link>

            <ul className="hidden lg:flex items-center gap-6 text-l font-medium">
              {features.map((item) => (
                <li key={item}>
                  <Link
                    href="/"
                    className="text-gray-900 hover:text-primary-700 dark:text-white dark:hover:text-primary-500"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Porção direita */}
          {rightSection}
        </div>
      </div>
    </nav>
  );
}
