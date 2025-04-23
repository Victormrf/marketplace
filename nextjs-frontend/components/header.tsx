"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  CircleHelp,
  LogOut,
  RotateCcw,
  Package,
  Settings,
  ShoppingCart,
  User,
} from "lucide-react";
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
  const [showUserPreferences, setShowUserPreferences] = useState(false);
  const userPrefButtonRef = useRef<HTMLButtonElement>(null);

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

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userPrefButtonRef.current &&
        !userPrefButtonRef.current.contains(event.target as Node)
      ) {
        setShowUserPreferences(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
            ref={userPrefButtonRef}
            onClick={() => setShowUserPreferences((prev) => !prev)}
            className="inline-flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
          >
            <User className="w-5 h-5" />
            <span className="hidden sm:inline">Account</span>
            <ChevronDown className="hidden sm:inline w-4 h-4" />
          </button>
          {showUserPreferences && (
            <div
              className="absolute left-3/4 -translate-x-1/2 mt-2 min-w-[160px] bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 z-50"
              style={{ top: "100%" }}
            >
              <Link
                href="#"
                className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
              >
                <Settings className="w-5 h-5" />
                <span>Configuration</span>
              </Link>
              <Link
                href="#"
                className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
              >
                <Package className="w-5 h-5" />
                <span>Orders</span>
              </Link>
              <Link
                href="#"
                className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Refund</span>
              </Link>
              <Link
                href="#"
                className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
              >
                <CircleHelp className="w-5 h-5" />
                <span>Help</span>
              </Link>
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
              <Link
                href="#"
                className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium mt-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Exit</span>
              </Link>
            </div>
          )}
        </div>
      );
    } else if (role === "seller") {
      setFeatures(["Dashboard", "Products", "Sales"]);
      setRightSection(
        <div className="relative flex items-center gap-4">
          {/* Conta */}
          <button
            type="button"
            ref={userPrefButtonRef}
            onClick={() => setShowUserPreferences((prev) => !prev)}
            className="inline-flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
          >
            <User className="w-5 h-5" />
            <span className="hidden sm:inline">Account</span>
            <ChevronDown className="hidden sm:inline w-4 h-4" />
          </button>
          {showUserPreferences && (
            <div
              className="absolute left-3/4 -translate-x-1/2 mt-2 min-w-[160px] bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 z-50"
              style={{ top: "100%" }}
            >
              <Link
                href="#"
                className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
              >
                <Settings className="w-5 h-5" />
                <span>Configuration</span>
              </Link>
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
              <Link
                href="#"
                className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium mt-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Exit</span>
              </Link>
            </div>
          )}
        </div>
      );
    } else if (role === "admin") {
      setFeatures(["Dashboard", "Users", "Support"]);
      setRightSection(
        <div className="relative flex items-center gap-4">
          {/* Conta */}
          <button
            type="button"
            ref={userPrefButtonRef}
            onClick={() => setShowUserPreferences((prev) => !prev)}
            className="inline-flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
          >
            <User className="w-5 h-5" />
            <span className="hidden sm:inline">Account</span>
            <ChevronDown className="hidden sm:inline w-4 h-4" />
          </button>
          {showUserPreferences && (
            <div
              className="absolute left-3/4 -translate-x-1/2 mt-2 min-w-[160px] bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 z-50"
              style={{ top: "100%" }}
            >
              <Link
                href="#"
                className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
              >
                <Settings className="w-5 h-5" />
                <span>Configuration</span>
              </Link>
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
              <Link
                href="#"
                className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium mt-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Exit</span>
              </Link>
            </div>
          )}
        </div>
      );
    }
  }, [role, onAuthClick, showUserPreferences]);

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
