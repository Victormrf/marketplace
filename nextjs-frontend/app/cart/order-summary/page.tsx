"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";

type Product = {
  id: string;
  image?: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  createdAt: string;
};

type CartItem = {
  id?: string;
  userdId?: string;
  productId: string;
  quantity: number;
  createdAt?: string;
  product?: Product;
};

type OrderSummaryData = {
  originalPrice?: number;
  savings?: number;
  storePickup?: number;
  tax?: number;
  total?: number;
};

type AddressData = {
  country?: string;
  city?: string;
  zipcode?: string;
  district?: string;
  street?: string;
  number?: string;
};

export default function OrderSummaryPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderSummary, setOrderSummary] = useState<OrderSummaryData>({});
  const [address, setAddress] = useState<AddressData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCart() {
      setLoading(true);

      try {
        const res = await fetch("http://localhost:8000/cart-items/", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) throw new Error("Erro ao buscar carrinho");
        const data = await res.json();
        setCartItems(
          data.map((item: CartItem) => ({
            productId: item.productId,
            quantity: item.quantity,
            product: item.product,
          }))
        );
      } catch {
        setCartItems([]);
      } finally {
        setLoading(false);
      }
    }
    fetchCart();
    if (typeof window !== "undefined") {
      setOrderSummary(
        JSON.parse(localStorage.getItem("order-summary") || "{}")
      );
      setAddress(JSON.parse(localStorage.getItem("delivery-address") || "{}"));
    }
  }, []);

  if (loading) {
    return (
      <section className="bg-white py-8 antialiased dark:bg-gray-900 md:py-16">
        <div className="mx-auto max-w-screen-xl px-4 2xl:px-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
            Loading order summary...
          </h2>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* --- Seção Principal: Resumo do Pedido --- */}
      <section className="bg-white py-8 antialiased dark:bg-gray-900 md:py-16">
        <div className="mx-auto max-w-4xl mb-8">
          <ol className="flex w-full items-center text-md font-medium">
            <li className="flex items-center flex-1 min-w-0 text-slate-900 ">
              <Link href={"/cart"}>
                <span className="flex items-center gap-0.5 whitespace-nowrap">
                  <svg
                    className="me-2 h-4 w-4 sm:h-5 sm:w-5"
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
                      d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  Cart
                </span>
              </Link>
              <span className="mx-4 flex-1 h-px bg-slate-900"></span>
            </li>
            <li className="flex items-center flex-1 min-w-0 text-slate-900 ">
              <Link href={"/cart/checkout"}>
                <span className="flex items-center gap-0.5 whitespace-nowrap">
                  <svg
                    className="me-2 h-4 w-4 sm:h-5 sm:w-5"
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
                      d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  Checkout
                </span>
              </Link>
              <span className="mx-4  flex-1 h-px bg-slate-900"></span>
            </li>
            <li className="flex items-center flex-1 min-w-0 text-slate-900">
              <span className="flex items-center gap-0.5 whitespace-nowrap">
                <svg
                  className="me-2 h-4 w-4 sm:h-5 sm:w-5"
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
                    d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                Order Summary
              </span>
              <span className="mx-4  flex-1 h-px bg-gray-200"></span>
            </li>
            <li className="flex items-center flex-1 min-w-0 text-gray-300">
              <span className="flex items-center gap-0.5 whitespace-nowrap">
                <svg
                  className="me-2 h-4 w-4 sm:h-5 sm:w-5"
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
                    d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
                Payment
              </span>
            </li>
          </ol>
        </div>
        <form action="#" className="mx-auto max-w-screen-xl px-4 2xl:px-0">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
              Order summary
            </h2>
            {address && (
              <div className="mt-6 space-y-4 border-b border-t border-gray-200 py-8 dark:border-gray-700 sm:mt-8">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Billing & Delivery information
                </h4>

                <dl>
                  <dt className="text-base font-medium text-gray-900 dark:text-white">
                    Individual
                  </dt>
                  <dd className="mt-1 text-base font-normal text-gray-500 dark:text-gray-400">
                    {address.zipcode} - {address.street}, {address.number},{" "}
                    {address.district}, {address.city}, {address.country}
                  </dd>
                </dl>
              </div>
            )}

            {/* --- Lista de Itens --- */}
            <div className="mt-6 sm:mt-8">
              <div className="relative overflow-x-auto border-b border-gray-200 dark:border-gray-800">
                {cartItems.length === 0 ? (
                  <div className="text-slate-500 dark:text-gray-400">
                    Seu carrinho está vazio.
                  </div>
                ) : (
                  <table className="w-full text-left font-medium text-gray-900 dark:text-white md:table-fixed">
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {cartItems.map((item, idx) => (
                        <tr key={`${item.productId}-${idx}`}>
                          <td className="whitespace-nowrap py-4 md:w-[384px]">
                            <div className="flex items-center gap-4">
                              <a
                                href="#"
                                className="flex items-center aspect-square w-10 h-10 shrink-0"
                              >
                                <Image
                                  height={100}
                                  width={100}
                                  className="h-auto w-full max-h-full dark:hidden"
                                  src={
                                    item.product?.image || "/placeholder.svg"
                                  }
                                  alt="product image"
                                />
                              </a>
                              <a href="#" className="hover:underline">
                                {item.product?.name}
                              </a>
                            </div>
                          </td>
                          <td className="p-4 pl-12 text-base font-normal text-gray-900 dark:text-white text-center align-middle">
                            x{item.quantity}
                          </td>
                          <td className="p-4 text-right text-base font-bold text-gray-900 dark:text-white">
                            {`$ ${
                              item.product
                                ? item.product.price * item.quantity
                                : null
                            }`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* --- Resumo Financeiro --- */}
              {orderSummary.originalPrice &&
                orderSummary.savings &&
                orderSummary.storePickup &&
                orderSummary.tax &&
                orderSummary.total && (
                  <div className="mt-4 space-y-6">
                    <h4 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Order summary
                    </h4>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <dl className="flex items-center justify-between gap-4">
                          <dt className="text-gray-500 dark:text-gray-400">
                            Original price
                          </dt>
                          <dd className="text-base font-medium text-gray-900 dark:text-white">
                            {`R$ ${orderSummary.originalPrice.toLocaleString(
                              "pt-BR",
                              {
                                minimumFractionDigits: 2,
                              }
                            )}`}
                          </dd>
                        </dl>
                        <dl className="flex items-center justify-between gap-4">
                          <dt className="text-gray-500 dark:text-gray-400">
                            Savings
                          </dt>
                          <dd className="text-base font-medium text-green-500">
                            -
                            {`R$ ${orderSummary.savings.toLocaleString(
                              "pt-BR",
                              {
                                minimumFractionDigits: 2,
                              }
                            )}`}
                          </dd>
                        </dl>
                        <dl className="flex items-center justify-between gap-4">
                          <dt className="text-gray-500 dark:text-gray-400">
                            Store Pickup
                          </dt>
                          <dd className="text-base font-medium text-gray-900 dark:text-white">
                            {`R$ ${orderSummary.storePickup.toLocaleString(
                              "pt-BR",
                              {
                                minimumFractionDigits: 2,
                              }
                            )}`}
                          </dd>
                        </dl>
                        <dl className="flex items-center justify-between gap-4">
                          <dt className="text-gray-500 dark:text-gray-400">
                            Tax
                          </dt>
                          <dd className="text-base font-medium text-gray-900 dark:text-white">
                            {`R$ ${orderSummary.tax.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}`}
                          </dd>
                        </dl>
                      </div>
                      <dl className="flex items-center justify-between gap-4 border-t border-gray-200 pt-2 dark:border-gray-700">
                        <dt className="text-lg font-bold text-gray-900 dark:text-white">
                          Total
                        </dt>
                        <dd className="text-lg font-bold text-gray-900 dark:text-white">
                          {`R$ ${orderSummary.total.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}`}
                        </dd>
                      </dl>
                    </div>

                    {/* --- Termos e Botões Finais --- */}
                    <div className="flex items-start sm:items-center">
                      <input
                        id="terms-checkbox-2"
                        type="checkbox"
                        value=""
                        className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-primary-600 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-primary-600"
                      />
                      <label
                        htmlFor="terms-checkbox-2"
                        className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
                      >
                        {" "}
                        I agree with the{" "}
                        <a
                          href="#"
                          title=""
                          className="text-primary-700 underline hover:no-underline dark:text-primary-500"
                        >
                          Terms and Conditions
                        </a>{" "}
                        of use of the Flowbite marketplace{" "}
                      </label>
                    </div>

                    <div className="gap-4 sm:flex sm:items-center">
                      <button
                        type="button"
                        className="w-full rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 hover:text-primary-700 focus:z-10 focus:outline-none focus:ring-4 focus:ring-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white dark:focus:ring-gray-700"
                      >
                        Return to Shopping
                      </button>
                      <Link
                        href="/cart/payment"
                        type="submit"
                        className="mt-4 flex w-full items-center justify-center rounded-lg bg-slate-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800 sm:mt-0"
                      >
                        Send the order
                      </Link>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </form>
      </section>
    </>
  );
}
