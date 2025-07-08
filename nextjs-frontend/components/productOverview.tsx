// app/product/[productId]/page.tsx (ou o caminho que preferir)

import Image from "next/image";
import React from "react";
import { CollapsibleText } from "./collapsibleText";
import { Product } from "@/types/product";

export default function ProductOverview(productData: Product) {
  const product = {
    imageUrl: productData.image,
    title: productData.name,
    price: `$ ${productData.price.toFixed(2)}`,
    ratingValue: productData.averageRating,
    reviewCount: 345,
    description: productData.description,
  };

  return (
    <section className="bg-white dark:bg-gray-900 antialiased">
      <div className="max-w-screen-xl mx-auto 2xl:px-0">
        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8 xl:gap-12 items-center">
          {/* --- Coluna da Imagem --- */}
          <div className=" flex justify-center items-center">
            <Image
              height={220}
              width={220}
              className="w-[240px] h-[240px] object-contain"
              src={product.imageUrl || "/placeholder.svg"}
              alt={product.title}
              priority
            />
          </div>

          {/* --- Coluna de Detalhes --- */}
          <div className="mt-4 lg:mt-0">
            <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl dark:text-white">
              {product.title}
            </h1>
            <div className="mt-3 sm:items-center sm:gap-4 sm:flex">
              <p className="text-2xl font-extrabold text-gray-900 sm:text-3xl dark:text-white">
                {product.price}
              </p>
              {/* --- Avaliações --- */}
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.round(product.ratingValue || 0)
                          ? "text-yellow-400"
                          : "text-gray-500"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 22 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M10 15l-5.878 3.09L5.5 12.5 1 8.91l6.061-.882L10 2.5l2.939 5.528L19 8.91l-4.5 3.59 1.378 5.59z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm font-medium leading-none text-gray-500 dark:text-gray-400">
                  ({product.ratingValue?.toFixed(1) || "N/A"})
                </p>
              </div>
            </div>

            {/* --- Botões de Ação --- */}
            <div className="mt-4 sm:gap-4 sm:items-center sm:flex">
              {/* Botão Favoritos */}
              <a
                href="#"
                title="Add to favorites"
                className="flex items-center justify-center py-2.5 px-5 text-sm font-medium text-slate-700 focus:outline-none bg-white rounded-lg border border-gray-200  hover:border-red-600 hover:text-red-600 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700"
                role="button"
              >
                <svg
                  className="w-5 h-5 -ms-2 me-2"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12.01 6.001C6.5 1 1 8 5.782 13.001L12.011 20l6.23-7C23 8 17.5 1 12.01 6.002Z"
                  />
                </svg>
                Add to favorites
              </a>
              {/* Botão Adicionar ao Carrinho */}
              <a
                href="#"
                title="Add to cart"
                className="flex items-center justify-center py-2.5 px-5 text-sm font-medium text-white focus:outline-none bg-slate-700 rounded-lg border border-slate-700 hover:bg-slate-900 hover:text-primary-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700"
                role="button"
              >
                <svg
                  className="w-5 h-5 -ms-2 me-2"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4h1.5L8 16m0 0h8m-8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm.75-3H7.5M11 7H6.312M17 4v6m-3-3h6"
                  />
                </svg>
                Add to cart
              </a>
            </div>

            <hr className="my-5 md:my-6 border-gray-200 dark:border-gray-800" />

            {/* --- Descrição --- */}
            <CollapsibleText text={product.description || ""} maxLength={100} />
          </div>
        </div>
      </div>
    </section>
  );
}
