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
  Heart,
  UserCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import AlertPopup from "./popups/alertPopup";

type UserRole = "CUSTOMER" | "SELLER" | "ADMIN" | null;

export default function Header({
  onAuthClick,
  refreshTrigger = 0,
}: {
  onAuthClick?: () => void;
  refreshTrigger?: number;
}) {
  const [name, setName] = useState(null);
  const [email, setEmail] = useState(null);
  const [role, setRole] = useState<UserRole>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [showUserPreferences, setShowUserPreferences] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const userPrefButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isManualLogout = useRef(false);

  async function logout() {
    try {
      isManualLogout.current = true;
      const res = await fetch("http://localhost:8000/users/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Logout failed");
      }

      setRole(null);
      setName(null);
      setEmail(null);
      setSellerId(null);
      setShowUserPreferences(false);
      localStorage.removeItem("cart");
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
      setRole(null);
      setName(null);
      setEmail(null);
      setSellerId(null);
      setShowUserPreferences(false);
      localStorage.removeItem("cart");
      router.push("/");
    }
  }

  const hasAttemptedLoginRef = useRef(false);

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const res = await fetch("http://localhost:8000/users/me", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          // Token inválido ou expirado
          setRole(null);
          setName(null);
          setEmail(null);
          setSellerId(null);

          if (hasAttemptedLoginRef.current && !isManualLogout.current) {
            setShowAlert(true);
            localStorage.removeItem("cart"); // Limpa o carrinho local se existir
            router.push("/");
          }
          return;
        }

        const user = await res.json();
        setRole(user.role || null);
        setName(user.name || null);
        setEmail(user.email || null);
        hasAttemptedLoginRef.current = true;

        // If user is a seller, fetch seller data
        if (user.role === "SELLER") {
          await fetchSellerData();
        }
      } catch (error) {
        console.error("Erro ao buscar o usuário:", error);
        setRole(null);
        setName(null);
        setEmail(null);
        setSellerId(null);

        if (
          hasAttemptedLoginRef.current &&
          !isManualLogout.current &&
          !pathname?.includes("/store/")
        ) {
          setShowAlert(true);
          localStorage.removeItem("cart");
          router.push("/");
        }
      }
    }

    // Set up an interval to check the token status every minute
    const intervalId = setInterval(fetchUserRole, 60000);

    // Initial fetch
    fetchUserRole();

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [router, refreshTrigger, pathname]);

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

  async function fetchSellerData() {
    try {
      const res = await fetch("http://localhost:8000/sellers/", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        setSellerId(null);
        return;
      }

      const seller = await res.json();
      setSellerId(seller.profile.id);
    } catch (error) {
      console.error("Seller data fetching error:", error);
    }
  }

  // Features do menu
  let features: { name: string; href: string }[] = [];
  if (!role) {
    features = [
      { name: "Home", href: "/" },
      { name: "Best Sellers", href: "/" },
      { name: "Gift Ideas", href: "/" },
      { name: "Today’s Deals", href: "/" },
    ];
  } else if (role === "CUSTOMER") {
    features = [
      { name: "Home", href: "/" },
      { name: "Best Sellers", href: "/" },
      { name: "Gift Ideas", href: "/" },
      { name: "Today’s Deals", href: "/" },
    ];
  } else if (role === "SELLER") {
    features = [
      { name: "Dashboard", href: `/store/${sellerId}/` },
      { name: "Customers", href: `/store/${sellerId}/customers` },
      { name: "Products", href: `/store/${sellerId}/products` },
    ];
  } else if (role === "ADMIN") {
    features = [
      { name: "Dashboard", href: "/" },
      { name: "Users", href: "/" },
      { name: "Support", href: "/" },
    ];
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
  } else if (role === "CUSTOMER") {
    rightSection = (
      <div className="relative flex items-center gap-4">
        <div className="relative">
          <Link
            href={"/wishlist"}
            className="inline-flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
          >
            <Heart className="w-5 h-5" />
            <span className="hidden sm:inline">My Favourites</span>
          </Link>
        </div>
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
          <span className="hidden sm:inline">My Account</span>
          <ChevronDown className="hidden sm:inline w-4 h-4" />
        </button>
        {showUserPreferences && (
          <div
            className="absolute left-80 -translate-x-1/4  min-w-[140px] bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 z-50"
            style={{ top: "100%" }}
          >
            <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {name || "Nome do Usuário"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {email || "email@exemplo.com"}
              </div>
            </div>
            <Link
              href="/profile"
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
            >
              <UserCircle className="w-5 h-5" />
              <span>Profile</span>
            </Link>
            <Link
              href="#"
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </Link>
            <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
            <Link
              href="/orders"
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
              <span>Refunds</span>
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
              <span>Log out</span>
            </button>
          </div>
        )}
      </div>
    );
  } else if (role === "SELLER") {
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
            <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {name || "Nome do Usuário"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {email || "email@exemplo.com"}
              </div>
            </div>
            <Link
              href="/profile"
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
            >
              <UserCircle className="w-5 h-5" />
              <span>Profile</span>
            </Link>
            <Link
              href="#"
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
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
  } else if (role === "ADMIN") {
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
            <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {name || "Nome do Usuário"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {email || "email@exemplo.com"}
              </div>
            </div>
            <Link
              href="#"
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
            >
              <UserCircle className="w-5 h-5" />
              <span>Profile</span>
            </Link>
            <Link
              href="#"
              className="flex items-center gap-2 w-full py-1 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
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
    <>
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
                {features.map((item, index) => (
                  <li key={index}>
                    <Link
                      href={item.href}
                      className="text-gray-900 hover:text-primary-700 hover:underline dark:text-white dark:hover:text-primary-500"
                    >
                      {item.name}
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
      {showAlert && (
        <AlertPopup
          message="Your session expired. Sign in again."
          action={{ href: "/", text: "Go to homepage" }}
          onClose={() => {
            setShowAlert(false);
            router.push("/");
          }}
        />
      )}
    </>
  );
}
