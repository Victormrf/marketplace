"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AlertPopup from "@/components/popups/alertPopup";
import { CollapsibleText } from "@/components/collapsibleText";
import { Product } from "@/types/product";
import { CartItem } from "@/types/cartItem";

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertPosition, setAlertPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{
    open: boolean;
    productId?: string;
  }>({ open: false });

  const checkoutBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    async function fetchCart() {
      setLoading(true);

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/cart-items/`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (res.ok) {
          setIsLoggedIn(true);
          const data = await res.json();
          setCartItems(
            data.map((item: CartItem) => ({
              productId: item.productId,
              quantity: item.quantity,
              product: item.product,
            }))
          );
        } else if (res.status === 401) {
          setIsLoggedIn(false);
          const localCart: CartItem[] = JSON.parse(
            localStorage.getItem("cart") || "[]"
          );

          if (localCart.length === 0) {
            setCartItems([]);
            return;
          }

          const ids = localCart.map((item) => item.productId).join(",");
          const productRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/products/${ids}`
          );

          if (!productRes.ok)
            throw new Error("Erro ao buscar produtos do carrinho");

          const productData = await productRes.json();
          const products: Product[] = productData.products;

          const merged = localCart.map((item) => ({
            ...item,
            product: products.find((p) => p.id === item.productId),
          }));

          setCartItems(merged);
        } else {
          throw new Error("Erro ao buscar carrinho");
        }
      } catch (error) {
        console.error("Erro ao buscar carrinho:", error);
        setCartItems([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCart();
  }, []);

  // Cálculos do resumo do pedido
  const originalPrice = cartItems.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0
  );
  const savings = cartItems.length > 0 ? 50 : 0; // Exemplo fixo
  const storePickup = cartItems.length > 0 ? 14.9 : 0;
  const tax = cartItems.reduce((sum, item) => sum + 10 * item.quantity, 0);
  const total = originalPrice - savings + storePickup + tax;

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "order-summary",
        JSON.stringify({ originalPrice, savings, storePickup, tax, total })
      );
    }
  }, [originalPrice, savings, storePickup, tax, total]);

  const router = useRouter();

  function handleProceedToCheckout() {
    if (isLoggedIn) {
      router.push("cart/checkout");
    } else {
      // Pega a posição do botão
      if (checkoutBtnRef.current) {
        const rect = checkoutBtnRef.current.getBoundingClientRect();
        setAlertPosition({
          top: rect.top + window.scrollY - 40, // 80px acima do botão (ajuste conforme altura do popup)
          left: rect.left + window.scrollX + rect.width / 2, // centraliza horizontalmente
        });
      }
      setShowAlert(true);
    }
  }

  function handleIncrement(item: CartItem) {
    if (!item.product) return;
    if (item.quantity < item.product.stock) {
      setCartItems((prev) =>
        prev.map((cartItem) =>
          cartItem.productId === item.productId
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      );

      // Atualiza localStorage (para usuários não autenticados)
      const localCart: CartItem[] = JSON.parse(
        localStorage.getItem("cart") || "[]"
      );
      localStorage.setItem(
        "cart",
        JSON.stringify(
          localCart.map((cartItem) =>
            cartItem.productId === item.productId
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          )
        )
      );

      // Atualiza backend (usuário autenticado via cookie)
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/cart-items/product/${item.productId}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: item.quantity + 1 }),
        }
      ).catch((error) => {
        alert("Erro ao atualizar produto no carrinho.");
        console.error(error);
      });
    }
  }

  function handleDecrement(item: CartItem) {
    if (item.quantity > 1) {
      setCartItems((prev) =>
        prev.map((cartItem) =>
          cartItem.productId === item.productId
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem
        )
      );

      // Atualiza localStorage (usuário anônimo)
      const localCart: CartItem[] = JSON.parse(
        localStorage.getItem("cart") || "[]"
      );
      localStorage.setItem(
        "cart",
        JSON.stringify(
          localCart.map((cartItem) =>
            cartItem.productId === item.productId
              ? { ...cartItem, quantity: cartItem.quantity - 1 }
              : cartItem
          )
        )
      );

      // Atualiza backend (usuário autenticado via cookie)
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/cart-items/product/${item.productId}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: item.quantity - 1 }),
        }
      ).catch((error) => {
        alert("Erro ao atualizar produto no carrinho.");
        console.error(error);
      });
    } else if (item.quantity === 1) {
      setRemoveConfirm({ open: true, productId: item.productId });
    }
  }

  function handleRemoveButton(item: CartItem) {
    setRemoveConfirm({ open: true, productId: item.productId });
  }

  function handleRemoveConfirmed() {
    setCartItems((prev) =>
      prev.filter((cartItem) => cartItem.productId !== removeConfirm.productId)
    );

    // Atualiza localStorage (usuário anônimo)
    const localCart: CartItem[] = JSON.parse(
      localStorage.getItem("cart") || "[]"
    );
    localStorage.setItem(
      "cart",
      JSON.stringify(
        localCart.filter(
          (cartItem) => cartItem.productId !== removeConfirm.productId
        )
      )
    );

    setRemoveConfirm({ open: false });

    // Remove do backend (usuário autenticado via cookie)
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/cart-items/product/${removeConfirm.productId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    ).catch((error) => {
      alert("Erro ao remover produto do carrinho.");
      console.error(error);
    });
  }

  function handleRemoveCancel() {
    setRemoveConfirm({ open: false });
  }

  if (loading) {
    return (
      <section className="bg-white py-8 antialiased dark:bg-gray-900 md:py-16">
        <div className="mx-auto max-w-screen-xl px-4 2xl:px-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
            Carregando carrinho...
          </h2>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white py-8 antialiased dark:bg-gray-900 md:py-16">
      <div className="mx-auto max-w-screen-xl px-4 2xl:px-0">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white sm:text-2xl">
          Shopping Cart
        </h2>

        <div className="mt-6 sm:mt-8 md:gap-6 lg:flex lg:items-start xl:gap-8">
          <div className="mx-auto w-full flex-none lg:max-w-2xl xl:max-w-4xl">
            <div className="space-y-6">
              {cartItems.length === 0 ? (
                <div className="text-slate-500 dark:text-gray-400">
                  Seu carrinho está vazio.
                </div>
              ) : (
                cartItems.map((item, idx) => (
                  <div
                    key={`${item.productId}-${idx}`}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:p-6"
                  >
                    <div className="space-y-4 md:flex md:items-center md:justify-between md:gap-6 md:space-y-0">
                      <a href="#" className="shrink-0 md:order-1">
                        <Image
                          className="h-20 w-20"
                          src={item.product?.image || "/placeholder.svg"}
                          alt={item.product?.name || "Produto"}
                          width={80}
                          height={80}
                        />
                      </a>
                      <label
                        htmlFor={`counter-input-${idx}`}
                        className="sr-only"
                      >
                        Choose quantity:
                      </label>
                      <div className="flex items-center justify-between md:order-3 md:justify-end">
                        <div className="flex items-center">
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus:ring-gray-700"
                            onClick={() => handleDecrement(item)}
                          >
                            <svg
                              className="h-2.5 w-2.5 text-gray-900 dark:text-white"
                              aria-hidden="true"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 18 2"
                            >
                              <path
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M1 1h16"
                              />
                            </svg>
                          </button>
                          <input
                            type="text"
                            id={`counter-input-${idx}`}
                            data-input-counter
                            className="w-10 shrink-0 border-0 bg-transparent text-center text-sm font-medium text-gray-900 focus:outline-none focus:ring-0 dark:text-white"
                            placeholder=""
                            value={item.quantity}
                            required
                            readOnly
                          />
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus:ring-gray-700"
                            onClick={() => handleIncrement(item)}
                            disabled={
                              item.quantity >= (item.product?.stock || 0)
                            }
                          >
                            <svg
                              className="h-2.5 w-2.5 text-gray-900 dark:text-white"
                              aria-hidden="true"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 18 18"
                            >
                              <path
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9 1v16M1 9h16"
                              />
                            </svg>
                          </button>
                        </div>
                        <div className="text-end md:order-4 md:w-32 ml-6">
                          <p className="text-base font-bold text-slate-800 dark:text-white">
                            {item.product
                              ? `R$ ${(
                                  item.product.price * item.quantity
                                ).toFixed(2)}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="w-full min-w-0 flex-1 space-y-4 md:order-2 md:max-w-md">
                        <a
                          href="#"
                          className="text-base font-medium text-slate-800 hover:underline dark:text-white"
                        >
                          {item.product?.name || "Produto"}
                        </a>
                        <CollapsibleText
                          text={item.product?.description || ""}
                          maxLength={100}
                        />
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 hover:underline dark:text-gray-400 dark:hover:text-white"
                          >
                            <svg
                              className="me-1.5 h-5 w-5"
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
                            Add to Favorites
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center text-sm font-medium text-red-600 hover:underline dark:text-red-500"
                            onClick={() => handleRemoveButton(item)}
                          >
                            <svg
                              className="me-1.5 h-5 w-5"
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
                                d="M6 18 17.94 6M18 18 6.06 6"
                              />
                            </svg>
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Order Summary e Gift Card */}
          <div className="mx-auto mt-6 max-w-4xl flex-1 space-y-6 lg:mt-0 lg:w-full">
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
              <p className="text-xl font-semibold text-slate-800 dark:text-white">
                Order summary
              </p>
              <div className="space-y-4">
                <div className="space-y-2 text-slate-500">
                  <dl className="flex items-center justify-between gap-4">
                    <dt className="text-base font-normal dark:text-gray-400">
                      Original price
                    </dt>
                    <dd className="text-base font-medium text-gray-900 dark:text-white">
                      {`R$ ${originalPrice.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}`}
                    </dd>
                  </dl>
                  <dl className="flex items-center justify-between gap-4">
                    <dt className="text-base font-normal dark:text-gray-400">
                      Savings
                    </dt>
                    <dd className="text-base font-medium text-green-600">
                      -
                      {`R$ ${savings.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}`}
                    </dd>
                  </dl>
                  <dl className="flex items-center justify-between gap-4">
                    <dt className="text-base font-normal dark:text-gray-400">
                      Store Pickup
                    </dt>
                    <dd className="text-base font-medium text-gray-900 dark:text-white">
                      {`R$ ${storePickup.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}`}
                    </dd>
                  </dl>
                  <dl className="flex items-center justify-between gap-4">
                    <dt className="text-base font-normal dark:text-gray-400">
                      Tax
                    </dt>
                    <dd className="text-base font-medium text-gray-900 dark:text-white">
                      {`R$ ${tax.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}`}
                    </dd>
                  </dl>
                </div>
                <dl className="flex items-center justify-between gap-4 border-t border-gray-200 pt-2 dark:border-gray-700">
                  <dt className="text-base font-bold text-slate-800 dark:text-white">
                    Total
                  </dt>
                  <dd className="text-base font-bold text-slate-800 dark:text-white">
                    {`R$ ${total.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}`}
                  </dd>
                </dl>
              </div>
              <button
                type="button"
                ref={checkoutBtnRef}
                onClick={handleProceedToCheckout}
                className="flex w-full items-center justify-center rounded-lg bg-slate-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800"
              >
                Proceed to Checkout
              </button>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  {" "}
                  or{" "}
                </span>
                <Link
                  href="/"
                  title=""
                  className="inline-flex items-center gap-2 text-sm font-bold text-slate-800 underline hover:no-underline dark:text-primary-500"
                >
                  Continue Shopping
                  <svg
                    className="h-5 w-5"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 12H5m14 0-4 4m4-4-4-4"
                    />
                  </svg>
                </Link>
              </div>
            </div>
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
              <form className="space-y-4">
                <div>
                  <label
                    htmlFor="voucher"
                    className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                  >
                    {" "}
                    Do you have a voucher or gift card?{" "}
                  </label>
                  <input
                    type="text"
                    id="voucher"
                    className="block w-full rounded-lg border border-gray-300 bg-gray-100 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
                    placeholder=""
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center rounded-lg bg-slate-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800"
                >
                  Apply Code
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      {/* Popup de confirmação de remoção */}
      {removeConfirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg p-6 shadow-lg max-w-sm w-full">
            <p className="mb-4 text-gray-900">
              Deseja remover este produto do carrinho?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                onClick={handleRemoveCancel}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                onClick={handleRemoveConfirmed}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Popup de alerta */}
      {showAlert && alertPosition && (
        <AlertPopup
          message="Log in to proceed with purchase."
          onClose={() => setShowAlert(false)}
          style={{
            position: "fixed",
            top: alertPosition.top,
            left: alertPosition.left,
            transform: "translate(-50%, -50%)", // centraliza acima do botão
            zIndex: 9999,
          }}
        />
      )}
    </section>
  );
}
