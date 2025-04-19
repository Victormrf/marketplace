import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, User } from "lucide-react";

export default function Header({ onAuthClick }: { onAuthClick?: () => void }) {
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
              {["Home", "Best Sellers", "Gift Ideas", "Today’s Deals"].map(
                (item) => (
                  <li key={item}>
                    <Link
                      href="/"
                      className="text-gray-900 hover:text-primary-700 dark:text-white dark:hover:text-primary-500"
                    >
                      {item}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Lado direito: carrinho + conta */}
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
        </div>
      </div>
    </nav>
  );
}
