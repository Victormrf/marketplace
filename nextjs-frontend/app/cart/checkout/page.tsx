"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

type OrderSummaryData = {
  originalPrice?: number;
  savings?: number;
  storePickup?: number;
  tax?: number;
  total?: number;
};

type Address = {
  id: number; // Para a key do React e identificação única
  country: string;
  city: string;
  zipcode: string;
  district: string;
  street: string;
  number: string;
};

export default function CheckoutPage() {
  const [orderSummary, setOrderSummary] = useState<OrderSummaryData>({});

  const initialAddress: Address = {
    id: 1, // ID inicial
    country: "US",
    city: "",
    zipcode: "",
    district: "",
    street: "",
    number: "",
  };
  const [addresses, setAddresses] = useState<Address[]>([initialAddress]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrderSummary(
        JSON.parse(localStorage.getItem("order-summary") || "{}")
      );
    }
  }, []);

  const handleAddressChange = (
    index: number,
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setAddresses((prevAddresses) =>
      prevAddresses.map((address, i) =>
        i === index ? { ...address, [name]: value } : address
      )
    );
  };

  const handleAddAddress = () => {
    if (addresses.length < 3) {
      setAddresses((prevAddresses) => [
        ...prevAddresses,
        {
          id: prevAddresses.length + 1,
          country: "US",
          city: "",
          zipcode: "",
          district: "",
          street: "",
          number: "",
        },
      ]);
    }
  };

  return (
    <section className="bg-white py-8 antialiased dark:bg-gray-900 md:py-16">
      <form action="#" className="mx-auto max-w-screen-xl px-4 2xl:px-0">
        {/* --- Stepper --- (mantido) */}
        <ol className="flex w-full max-w-5xl items-center text-md font-medium">
          <li className="flex items-center flex-1 min-w-0 text-slate-900 ">
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
            <span className="mx-4 flex-1 h-px bg-gray-200"></span>
          </li>
          <li className="flex items-center flex-1 min-w-0 text-slate-900 ">
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
        <div className="mt-6 sm:mt-8 lg:grid lg:grid-cols-3 lg:items-start lg:gap-12 xl:gap-16">
          <div className="min-w-0 lg:col-span-2 space-y-8">
            {/* --- Detalhes da Entrega --- */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
                Delivery Details
              </h2>
              {addresses.map((address, index) => (
                <div
                  key={address.id}
                  className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800 relative"
                >
                  {/* Botão X para remover endereço */}
                  {addresses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddresses((prev) =>
                          prev.filter((a) => a.id !== address.id)
                        );
                      }}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-600 rounded-full p-1 transition"
                      title="Remover endereço"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                  {/* --- Cabeçalho do Endereço --- */}
                  <h3 className="mb-4 text-lg font-medium text-slate-800 dark:text-white">
                    Address {index + 1}:{" "}
                    <span className="text-slate-600 dark:text-gray-400">
                      {address.street || "[Street]"},{" "}
                      {address.district || "[District]"},{" "}
                      {address.city || "[City]"}
                    </span>
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`country-${address.id}`}
                        className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                      >
                        {" "}
                        Country*{" "}
                      </label>
                      <select
                        id={`country-${address.id}`}
                        name="country"
                        value={address.country}
                        onChange={(e) => handleAddressChange(index, e)}
                        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
                      >
                        <option value="US">United States</option>
                        <option value="BR">Brasil</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor={`city-${address.id}`}
                        className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                      >
                        {" "}
                        City*{" "}
                      </label>
                      <input
                        type="text"
                        id={`zipcode-${address.id}`}
                        name="zipcode"
                        value={address.zipcode}
                        onChange={(e) => handleAddressChange(index, e)}
                        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`zipcode-${address.id}`}
                        className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                      >
                        {" "}
                        Zipcode*{" "}
                      </label>
                      <input
                        type="text"
                        id={`zipcode-${address.id}`}
                        name="zipcode"
                        value={address.zipcode}
                        onChange={(e) => handleAddressChange(index, e)}
                        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`district-${address.id}`}
                        className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                      >
                        {" "}
                        District{" "}
                      </label>
                      <input
                        type="text"
                        id={`district-${address.id}`}
                        name="district"
                        value={address.district}
                        onChange={(e) => handleAddressChange(index, e)}
                        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`street-${address.id}`}
                        className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                      >
                        {" "}
                        Street{" "}
                      </label>
                      <input
                        type="text"
                        id={`street-${address.id}`} // ID único
                        name="street" // Name para o handler
                        value={address.street} // Valor controlado
                        onChange={(e) => handleAddressChange(index, e)} // Handler
                        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
                        // required (opcional para street)
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`number-${address.id}`}
                        className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                      >
                        {" "}
                        Number{" "}
                      </label>
                      <input
                        type="number"
                        id={`number-${address.id}`}
                        name="number"
                        value={address.number}
                        onChange={(e) => handleAddressChange(index, e)}
                        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500 no-spinner"
                        placeholder="123"
                      />
                    </div>
                  </div>
                </div>
              ))}{" "}
              {addresses.length < 3 && (
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddAddress}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 hover:text-primary-700 focus:z-10 focus:outline-none focus:ring-4 focus:ring-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white dark:focus:ring-gray-700"
                  >
                    <svg
                      className="h-5 w-5"
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
                        d="M5 12h14m-7 7V5"
                      />
                    </svg>
                    Add new address
                  </button>
                </div>
              )}
            </div>{" "}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-white">
                Payment
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Opção 1: Cartão de Crédito */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 ps-4 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-start">
                    <div className="flex h-5 items-center">
                      <input
                        id="credit-card"
                        aria-describedby="credit-card-text"
                        type="radio"
                        name="payment-method"
                        value=""
                        className="h-4 w-4 border-gray-300 bg-white text-primary-600 focus:ring-2 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-primary-600"
                        defaultChecked
                      />
                    </div>
                    <div className="ms-4 text-sm">
                      <label
                        htmlFor="credit-card"
                        className="font-medium leading-none text-gray-900 dark:text-white"
                      >
                        {" "}
                        Credit Card{" "}
                      </label>
                      <p
                        id="credit-card-text"
                        className="mt-1 text-xs font-normal text-gray-500 dark:text-gray-400"
                      >
                        Pay with your credit card
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                      Delete
                    </button>
                    <div className="h-3 w-px shrink-0 bg-gray-200 dark:bg-gray-700"></div>
                    <button
                      type="button"
                      className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {/* Opção 3: PayPal */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 ps-4 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-start">
                    <div className="flex h-5 items-center">
                      <input
                        id="paypal-2"
                        aria-describedby="paypal-text"
                        type="radio"
                        name="payment-method"
                        value=""
                        className="h-4 w-4 border-gray-300 bg-white text-primary-600 focus:ring-2 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-primary-600"
                      />
                    </div>
                    <div className="ms-4 text-sm">
                      <label
                        htmlFor="paypal-2"
                        className="font-medium leading-none text-gray-900 dark:text-white"
                      >
                        {" "}
                        Paypal account{" "}
                      </label>
                      <p
                        id="paypal-text"
                        className="mt-1 text-xs font-normal text-gray-500 dark:text-gray-400"
                      >
                        Connect to your account
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                      Delete
                    </button>
                    <div className="h-3 w-px shrink-0 bg-gray-200 dark:bg-gray-700"></div>
                    <button
                      type="button"
                      className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Delivery Methods
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Opção 1: DHL */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 ps-4 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-start">
                    <div className="flex h-5 items-center">
                      <input
                        id="dhl"
                        aria-describedby="dhl-text"
                        type="radio"
                        name="delivery-method"
                        value=""
                        className="h-4 w-4 border-gray-300 bg-white text-primary-600 focus:ring-2 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-primary-600"
                        defaultChecked
                      />
                    </div>
                    <div className="ms-4 text-sm">
                      <label
                        htmlFor="dhl"
                        className="font-medium leading-none text-gray-900 dark:text-white"
                      >
                        {" "}
                        $15 - DHL Fast Delivery{" "}
                      </label>
                      {/* O restante do texto dentro do label foi removido para manter o código mais curto, mas você pode adicioná-lo de volta se precisar */}
                      <p
                        id="dhl-text"
                        className="mt-1 text-xs font-normal text-gray-500 dark:text-gray-400"
                      >
                        Estimated 3-5 days
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>{" "}
          {orderSummary.originalPrice &&
            orderSummary.savings &&
            orderSummary.storePickup &&
            orderSummary.tax &&
            orderSummary.total && (
              <div className="lg:col-span-1 rounded-lg bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
                <div className="space-y-2">
                  <dl className="flex items-center justify-between gap-4">
                    <dt className="text-base font-normal text-gray-500 dark:text-gray-400">
                      Subtotal
                    </dt>
                    <dd className="text-base font-medium text-slate-800 dark:text-white">
                      {`R$ ${orderSummary.originalPrice.toLocaleString(
                        "pt-BR",
                        {
                          minimumFractionDigits: 2,
                        }
                      )}`}
                    </dd>
                  </dl>
                  <span className="flex h-px bg-gray-200"></span>
                  <dl className="flex items-center justify-between gap-4">
                    <dt className="text-base font-normal text-slate-500 dark:text-gray-400">
                      Savings
                    </dt>
                    <dd className="text-base font-medium text-green-600">
                      -
                      {`R$ ${orderSummary.savings.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}`}
                    </dd>
                  </dl>
                  <span className="flex h-px bg-gray-200"></span>
                  <dl className="flex items-center justify-between gap-4">
                    <dt className="text-base font-normal text-gray-500 dark:text-gray-400">
                      Store Pickup
                    </dt>
                    <dd className="text-base font-medium text-slate-800 dark:text-white">
                      {`R$ ${orderSummary.storePickup.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}`}
                    </dd>
                  </dl>
                  <span className="flex h-px bg-gray-200"></span>
                  <dl className="flex items-center justify-between gap-4">
                    <dt className="text-base font-normal text-gray-500 dark:text-gray-400">
                      Tax
                    </dt>
                    <dd className="text-base font-medium text-slate-800 dark:text-white">
                      {`R$ ${orderSummary.tax.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}`}
                    </dd>
                  </dl>
                  <span className="flex h-px bg-gray-200"></span>
                  <dl className="flex items-center justify-between gap-4 ">
                    <dt className="text-base font-bold text-slate-800 dark:text-white">
                      Total
                    </dt>
                    <dd className="text-base font-bold text-slate-800 dark:text-white">
                      {`R$ ${orderSummary.total.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}`}
                    </dd>
                  </dl>
                </div>
                <Link
                  href="/cart/order-summary"
                  className="flex w-full items-center justify-center rounded-lg bg-slate-700 px-5 py-2.5 mt-6 text-sm font-medium text-white hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800"
                >
                  Proceed to Payment
                </Link>
              </div>
            )}
        </div>{" "}
      </form>
    </section>
  );
}
