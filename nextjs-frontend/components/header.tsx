"use client";
import { useEffect, useRef, useState } from "react";
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
  Star,
  Truck,
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
  const [showUserPreferences, setShowUserPreferences] = useState(false);
  const userPrefButtonRef = useRef<HTMLButtonElement>(null);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("cart");
    setRole(null);
    setShowUserPreferences(false);
  }

  useEffect(() => {
    function syncRoleWithToken() {
      const token = localStorage.getItem("token");
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
    }
    syncRoleWithToken();
    window.addEventListener("storage", syncRoleWithToken);
    return () => window.removeEventListener("storage", syncRoleWithToken);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userPrefButtonRef.current &&
        !userPrefButtonRef.current.contains(event.target as Node)
      ) {
        // Pequeno delay para permitir o clique no botão Exit
        setTimeout(() => setShowUserPreferences(false), 100);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Features do menu
  let features: string[] = [];
  if (!role) {
    features = ["Home", "Best Sellers", "Gift Ideas", "Today’s Deals"];
  } else if (role === "customer") {
    features = ["Home", "Best Sellers", "Gift Ideas", "Today’s Deals"];
  } else if (role === "seller") {
    features = ["Dashboard", "Products", "Sales"];
  } else if (role === "admin") {
    features = ["Dashboard", "Users", "Support"];
  }

  // JSX da seção direita
  let rightSection = null;
  if (!role) {
    rightSection = (
      <div className="relative flex items-center gap-4">
        <div className="relative">
          <Link
            href={"/cart"}
            className="inline-flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="hidden sm:inline">My Cart</span>
          </Link>
        </div>
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
    rightSection = (
      <div className="relative flex items-center gap-4">
        <div className="relative">
          <Link
            href={"/cart"}
            className="inline-flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="hidden sm:inline">My Cart</span>
          </Link>
        </div>

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
            className="absolute left-1/2 -translate-x-1/2 mt-2 min-w-[200px] bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 z-50"
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
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
            >
              <Package className="w-5 h-5" />
              <span>Orders</span>
            </Link>
            <Link
              href="#"
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
            >
              <Star className="w-5 h-5" />
              <span>Reviews</span>
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

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium mt-2"
            >
              <LogOut className="w-5 h-5" />
              <span>Exit</span>
            </button>
          </div>
        )}
      </div>
    );
  } else if (role === "seller") {
    rightSection = (
      <div className="relative flex items-center gap-4">
        <button
          type="button"
          ref={userPrefButtonRef}
          onClick={() => setShowUserPreferences((prev) => !prev)}
          className="inline-flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
        >
          <User className="w-5 h-5" />
          <span className="hidden sm:inline">My Account</span>
          <ChevronDown className="hidden sm:inline w-4 h-4" />
        </button>
        {showUserPreferences && (
          <div
            className="absolute left-1/2 -translate-x-1/2 mt-2 min-w-[200px] bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 z-50"
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
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
            >
              <Truck className="w-5 h-5" />
              <span>Deliveries</span>
            </Link>
            <Link
              href="#"
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
            >
              <CircleHelp className="w-5 h-5" />
              <span>Help</span>
            </Link>
            <div className="my-2 border-t border-gray-200 dark:border-gray-700" />

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium mt-2"
            >
              <LogOut className="w-5 h-5" />
              <span>Exit</span>
            </button>
          </div>
        )}
      </div>
    );
  } else if (role === "admin") {
    rightSection = (
      <div className="relative flex items-center gap-4">
        <button
          type="button"
          ref={userPrefButtonRef}
          onClick={() => setShowUserPreferences((prev) => !prev)}
          className="inline-flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
        >
          <User className="w-5 h-5" />
          <span className="hidden sm:inline">My Account</span>
          <ChevronDown className="hidden sm:inline w-4 h-4" />
        </button>
        {showUserPreferences && (
          <div
            className="absolute left-1/2 -translate-x-1/2 mt-2 min-w-[200px] bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 z-50"
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

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium mt-2"
            >
              <LogOut className="w-5 h-5" />
              <span>Exit</span>
            </button>
          </div>
        )}
      </div>
    );
  }

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
