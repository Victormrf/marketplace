import Link from "next/link";
import {
  Laptop,
  Dumbbell,
  Utensils,
  Home as HomeIcon,
  Search,
} from "lucide-react";
import CategoryCard from "@/components/categoryCard";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 shadow bg-white">
        <Link href="/" className="text-xl font-bold">
          V·Market
        </Link>
        <Link
          href="/login"
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 text-sm"
        >
          Sign In / Register
        </Link>
      </header>

      {/* Hero */}
      <section className="text-center py-20 px-4">
        <h1 className="text-4xl font-bold mb-4">Find Everything You Need</h1>
        <p className="text-lg text-gray-600 mb-8">
          Your one-stop marketplace for all products
        </p>
        <div className="flex justify-center max-w-md mx-auto">
          <input
            type="text"
            placeholder="Search for products..."
            className="px-4 py-2 w-full border border-gray-300 rounded-l"
          />
          <button className="flex items-center justify-center gap-2 px-4 bg-black text-white rounded-r hover:bg-gray-800">
            <Search /> Search
          </button>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 bg-white text-center">
        <h2 className="text-xl font-semibold mb-6">Popular Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 px-6">
          <CategoryCard
            icon={<Laptop className="w-6 h-6" />}
            label="Electronics"
          />
          <CategoryCard
            icon={<Dumbbell className="w-6 h-6" />}
            label="Sports"
          />
          <CategoryCard icon={<Utensils className="w-6 h-6" />} label="Food" />
          <CategoryCard
            icon={<HomeIcon className="w-6 h-6" />}
            label="Home Decor"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 text-sm text-center py-6">
        <p className="mb-2">© 2025 Victor Fernandes. All rights reserved.</p>
      </footer>
    </div>
  );
}
