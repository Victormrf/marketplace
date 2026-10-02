"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, LogOut, Package, ShoppingCart, User, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import AlertPopup from "./popups/alertPopup";
import { useAuth } from "@/context/authContext";
import { logout as logoutSession } from "@/services/auth";
import { getMySellerProfile } from "@/services/seller";

export default function Header({ onAuthClick }: { onAuthClick?: () => void }) {
  const { user, setUser } = useAuth();
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showError, setShowError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    setSellerId(null);
    if (user?.role === "SELLER") {
      getMySellerProfile()
        .then((profile) => {
          if (!cancelled) setSellerId(profile.id);
        })
        .catch(() => {
          if (!cancelled) setSellerId(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const handleLogout = async () => {
    try {
      await logoutSession();
      setUser(null);
      setShowMenu(false);
      router.refresh();
      router.push("/");
    } catch {
      setShowError(true);
    }
  };

  return (
    <>
      <nav className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex w-full items-center justify-between px-6 py-4 md:px-10">
          <Link href="/" className="shrink-0">
            <Image src="/v-market-logo.png" alt="V-Market" width={80} height={80} />
          </Link>
          <div className="flex items-center gap-4">
            {user?.role === "SELLER" && sellerId && (
              <Link href={`/store/${sellerId}`} className="text-sm hover:underline">
                Minha loja
              </Link>
            )}
            {user?.role === "SELLER" && sellerId && (
              <Link href={`/store/${sellerId ?? ""}/products`} className="text-sm hover:underline">
                Produtos
              </Link>
            )}
            {user?.role === "SELLER" && sellerId && (
              <Link href={`/store/${sellerId}/orders`} className="text-sm hover:underline">
                Pedidos
              </Link>
            )}
            {user?.role === "CUSTOMER" && (
              <>
                <Link href="/cart" className="inline-flex items-center gap-2 text-sm">
                  <ShoppingCart className="h-4 w-4" /> Carrinho
                </Link>
              </>
            )}
            {!user && (
              <>
                <Link href="/cart" className="inline-flex items-center gap-2 text-sm">
                  <ShoppingCart className="h-4 w-4" /> Carrinho
                </Link>
                <button type="button" onClick={onAuthClick} className="text-sm underline">
                  Entrar
                </button>
              </>
            )}
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowMenu((open) => !open)}
                  className="inline-flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-expanded={showMenu}
                >
                  <User className="h-4 w-4" />
                  <span>{user.name}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 z-50 mt-2 min-w-48 rounded bg-white p-4 shadow-lg dark:bg-gray-800">
                    <p className="mb-3 text-xs text-gray-500">{user.email}</p>
                    <Link href="/profile" className="flex items-center gap-2 py-2 text-sm">
                      <UserCircle className="h-4 w-4" /> Perfil
                    </Link>
                    {user.role === "CUSTOMER" && (
                      <>
                        <Link href="/orders" className="flex items-center gap-2 py-2 text-sm">
                          <Package className="h-4 w-4" /> Meus pedidos
                        </Link>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-2 py-2 text-sm"
                    >
                      <LogOut className="h-4 w-4" /> Sair
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
      {showError && (
        <AlertPopup
          message="Não foi possível encerrar a sessão. Tente novamente."
          action={{ href: "/profile", text: "Voltar ao perfil" }}
          onClose={() => setShowError(false)}
        />
      )}
    </>
  );
}
