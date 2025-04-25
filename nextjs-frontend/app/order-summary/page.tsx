// app/order-summary/page.tsx (ou o caminho desejado)
"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

// Nota: Este componente apenas replica a estrutura visual estática.
// A interatividade (abrir/fechar modal, dropdowns, tooltips, checkbox de collapse)
// precisaria ser implementada usando React State (useState) e manipuladores de eventos.

export default function OrderSummaryPage() {
  // Exemplo (comentado) de como o estado do modal seria gerenciado:
  // const [isModalOpen, setIsModalOpen] = React.useState(false);
  // const [showCompanyInfo, setShowCompanyInfo] = React.useState(false);

  return (
    // Usamos um Fragment (<>) para retornar múltiplos elementos de nível superior (section e div do modal)
    <>
      {/* --- Seção Principal: Resumo do Pedido --- */}
      <section className="bg-white py-8 antialiased dark:bg-gray-900 md:py-16">
        <div className="mx-auto max-w-4xl mb-8">
          <ol className="flex w-full items-center text-md font-medium">
            <li className="flex items-center flex-1 min-w-0 text-cyan-700 ">
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
            <li className="flex items-center flex-1 min-w-0 text-cyan-800 ">
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
            <li className="flex items-center flex-1 min-w-0 text-cyan-700">
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
        {/* O form aqui pode envolver apenas a parte principal ou tudo, dependendo da lógica */}
        <form action="#" className="mx-auto max-w-screen-xl px-4 2xl:px-0">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
              Order summary
            </h2>

            {/* --- Informações de Faturamento e Entrega --- */}
            <div className="mt-6 space-y-4 border-b border-t border-gray-200 py-8 dark:border-gray-700 sm:mt-8">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                Billing & Delivery information
              </h4>

              <dl>
                <dt className="text-base font-medium text-gray-900 dark:text-white">
                  Individual
                </dt>
                <dd className="mt-1 text-base font-normal text-gray-500 dark:text-gray-400">
                  Bonnie Green - +1 234 567 890, San Francisco, California,
                  United States, 3454, Scott Street
                </dd>
              </dl>

              {/* Botão para abrir o modal (precisaria de onClick com lógica de estado) */}
              <button
                type="button"
                // data-modal-target="billingInformationModal" // Atributos data-* podem não funcionar sem JS específico
                // data-modal-toggle="billingInformationModal" // Usar onClick em React
                // onClick={() => setIsModalOpen(true)} // Exemplo de como seria com estado
                className="text-base font-medium text-primary-700 hover:underline dark:text-primary-500"
              >
                Edit
              </button>
            </div>

            {/* --- Lista de Itens --- */}
            <div className="mt-6 sm:mt-8">
              <div className="relative overflow-x-auto border-b border-gray-200 dark:border-gray-800">
                <table className="w-full text-left font-medium text-gray-900 dark:text-white md:table-fixed">
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {/* Item 1 */}
                    <tr>
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
                              src="https://flowbite.s3.amazonaws.com/blocks/e-commerce/imac-front.svg"
                              alt="imac image"
                            />
                            <Image
                              height={100}
                              width={100}
                              className="hidden h-auto w-full max-h-full dark:block"
                              src="https://flowbite.s3.amazonaws.com/blocks/e-commerce/imac-front-dark.svg"
                              alt="imac image"
                            />
                          </a>
                          <a href="#" className="hover:underline">
                            Apple iMac 27”
                          </a>
                        </div>
                      </td>
                      <td className="p-4 text-base font-normal text-gray-900 dark:text-white">
                        x1
                      </td>
                      <td className="p-4 text-right text-base font-bold text-gray-900 dark:text-white">
                        $1,499
                      </td>
                    </tr>
                    {/* Item 2 */}
                    <tr>
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
                              src="https://flowbite.s3.amazonaws.com/blocks/e-commerce/iphone-light.svg"
                              alt="iphone image"
                            />
                            <Image
                              height={100}
                              width={100}
                              className="hidden h-auto w-full max-h-full dark:block"
                              src="https://flowbite.s3.amazonaws.com/blocks/e-commerce/iphone-dark.svg"
                              alt="iphone image"
                            />
                          </a>
                          <a href="#" className="hover:underline">
                            Apple iPhone 14
                          </a>
                        </div>
                      </td>
                      <td className="p-4 text-base font-normal text-gray-900 dark:text-white">
                        x2
                      </td>
                      <td className="p-4 text-right text-base font-bold text-gray-900 dark:text-white">
                        $1,998
                      </td>
                    </tr>
                    {/* Item 3 */}
                    <tr>
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
                              src="https://flowbite.s3.amazonaws.com/blocks/e-commerce/ipad-light.svg"
                              alt="ipad image"
                            />
                            <Image
                              height={100}
                              width={100}
                              className="hidden h-auto w-full max-h-full dark:block"
                              src="https://flowbite.s3.amazonaws.com/blocks/e-commerce/ipad-dark.svg"
                              alt="ipad image"
                            />
                          </a>
                          <a href="#" className="hover:underline">
                            Apple iPad Air
                          </a>
                        </div>
                      </td>
                      <td className="p-4 text-base font-normal text-gray-900 dark:text-white">
                        x1
                      </td>
                      <td className="p-4 text-right text-base font-bold text-gray-900 dark:text-white">
                        $898
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* --- Resumo Financeiro --- */}
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
                        $6,592.00
                      </dd>
                    </dl>
                    <dl className="flex items-center justify-between gap-4">
                      <dt className="text-gray-500 dark:text-gray-400">
                        Savings
                      </dt>
                      <dd className="text-base font-medium text-green-500">
                        -$299.00
                      </dd>
                    </dl>
                    <dl className="flex items-center justify-between gap-4">
                      <dt className="text-gray-500 dark:text-gray-400">
                        Store Pickup
                      </dt>
                      <dd className="text-base font-medium text-gray-900 dark:text-white">
                        $99
                      </dd>
                    </dl>
                    <dl className="flex items-center justify-between gap-4">
                      <dt className="text-gray-500 dark:text-gray-400">Tax</dt>
                      <dd className="text-base font-medium text-gray-900 dark:text-white">
                        $799
                      </dd>
                    </dl>
                  </div>
                  <dl className="flex items-center justify-between gap-4 border-t border-gray-200 pt-2 dark:border-gray-700">
                    <dt className="text-lg font-bold text-gray-900 dark:text-white">
                      Total
                    </dt>
                    <dd className="text-lg font-bold text-gray-900 dark:text-white">
                      $7,191.00
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
                    href="/payment"
                    type="submit"
                    className="mt-4 flex w-full items-center justify-center rounded-lg bg-cyan-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-cyan-800 focus:outline-none focus:ring-4 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800 sm:mt-0"
                  >
                    Send the order
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </form>
      </section>

      {/* --- Modal: Editar Informações de Faturamento --- */}
      {/* A visibilidade seria controlada por estado, ex: className={`... ${isModalOpen ? 'flex' : 'hidden'}`} */}
      <div
        id="billingInformationModal"
        tabIndex={-1}
        aria-hidden="true"
        // className={`fixed left-0 right-0 top-0 z-50 h-[calc(100%-1rem)] max-h-auto w-full max-h-full items-center justify-center overflow-y-auto overflow-x-hidden antialiased md:inset-0 ${isModalOpen ? 'flex' : 'hidden'}`} // Exemplo com estado
        className="fixed left-0 right-0 top-0 z-50 hidden h-[calc(100%-1rem)] max-h-auto w-full max-h-full items-center justify-center overflow-y-auto overflow-x-hidden antialiased md:inset-0" // Classe original 'hidden'
      >
        <div className="relative max-h-auto w-full max-h-full max-w-lg p-4">
          {/* Conteúdo do Modal */}
          <div className="relative rounded-lg bg-white shadow dark:bg-gray-800">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between rounded-t border-b border-gray-200 p-4 dark:border-gray-700 md:p-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Billing Information
              </h3>
              {/* Botão fechar (precisaria de onClick com lógica de estado) */}
              <button
                type="button"
                className="ms-auto inline-flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white"
                // data-modal-toggle="billingInformationModal" // Usar onClick em React
                // onClick={() => setIsModalOpen(false)} // Exemplo com estado
              >
                <svg
                  className="h-3 w-3"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 14 14"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                  />
                </svg>
                <span className="sr-only">Close modal</span>
              </button>
            </div>
            {/* Corpo do Modal */}
            {/* Usar tag <form> ou <div> dependendo se é um formulário separado */}
            <form className="p-4 md:p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-5">
                {/* Checkbox para informações da empresa (precisaria de estado/onChange) */}
                <div className="flex items-center gap-4 sm:col-span-2">
                  <div className="flex items-center">
                    <input
                      id="company_address_billing_modal"
                      // data-collapse-toggle="company-info-container-modal" // Usar estado/onChange
                      // aria-expanded={showCompanyInfo} // Exemplo com estado
                      // onChange={(e) => setShowCompanyInfo(e.target.checked)} // Exemplo com estado
                      // defaultChecked={false} // ou checked={showCompanyInfo}
                      type="checkbox"
                      value=""
                      name="address-type-modal"
                      className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-primary-600 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-primary-600"
                    />
                    <label
                      htmlFor="company_address_billing_modal"
                      className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
                    >
                      {" "}
                      Order as a company{" "}
                    </label>
                  </div>
                </div>

                {/* Container de informações da empresa (visibilidade controlada por estado) */}
                <div
                  // className={`grid grid-cols-2 gap-4 sm:col-span-2 ${showCompanyInfo ? '' : 'hidden'}`} // Exemplo com estado
                  className="grid-hidden grid-cols-2 gap-4 sm:col-span-2" // Classe original 'hidden'
                  id="company-info-container-modal"
                >
                  <div>
                    <label
                      htmlFor="company_name"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                    >
                      {" "}
                      Company name{" "}
                    </label>
                    <input
                      type="text"
                      id="company_name"
                      className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
                      placeholder="Flowbite LLC"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="vat_number"
                      className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                    >
                      {" "}
                      VAT number{" "}
                    </label>
                    <input
                      type="text"
                      id="vat_number"
                      className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
                      placeholder="DE42313253"
                    />
                  </div>
                </div>

                {/* Endereço Salvo e Tooltip (precisaria de lógica/estado para tooltip) */}
                <div className="sm:col-span-2">
                  <div className="mb-2 flex items-center gap-1">
                    <label
                      htmlFor="saved-address-modal"
                      className="block text-sm font-medium text-gray-900 dark:text-white"
                    >
                      {" "}
                      Saved Address{" "}
                    </label>
                    {/* Tooltip SVG (data-* não funcionará sem JS, precisaria de lib React) */}
                    <svg
                      // data-tooltip-target="saved-address-modal-desc-2"
                      // data-tooltip-trigger="hover"
                      className="h-4 w-4 text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white"
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm9.408-5.5a1 1 0 1 0 0 2h.01a1 1 0 1 0 0-2h-.01ZM10 10a1 1 0 1 0 0 2h1v3h-1a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2h-1v-4a1 1 0 0 0-1-1h-2Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <select
                    id="saved-address-modal"
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
                  >
                    <option selected>Choose one of your saved address</option>
                    <option value="address-1">
                      San Francisco, California, United States, 3454, Scott
                      Street
                    </option>
                    <option value="address-2">
                      New York, United States, Broadway 10012
                    </option>
                  </select>
                  {/* Conteúdo do Tooltip (precisaria de lib React para exibir) */}
                  <div
                    id="saved-address-modal-desc-2"
                    role="tooltip"
                    className="tooltip invisible absolute z-10 inline-block rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white opacity-0 shadow-sm transition-opacity duration-300 dark:bg-gray-700"
                  >
                    Choose one of your saved addresses
                    <div className="tooltip-arrow" data-popper-arrow></div>
                  </div>
                </div>

                {/* Campos Nome e Sobrenome */}
                <div>
                  <label
                    htmlFor="first_name_billing_modal"
                    className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                  >
                    {" "}
                    First Name*{" "}
                  </label>
                  <input
                    type="text"
                    id="first_name_billing_modal"
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
                    placeholder="Enter your first name"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="last_name_billing_modal"
                    className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                  >
                    {" "}
                    Last Name*{" "}
                  </label>
                  <input
                    type="text"
                    id="last_name_billing_modal"
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
                    placeholder="Enter your last name"
                    required
                  />
                </div>

                {/* Campo Telefone com Dropdown (precisaria de estado/lógica para dropdown) */}
                <div className="sm:col-span-2">
                  <label
                    htmlFor="phone-input_billing_modal"
                    className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                  >
                    {" "}
                    Phone Number*{" "}
                  </label>
                  <div className="flex items-center">
                    {/* Botão Dropdown (precisaria de onClick/estado) */}
                    <button
                      id="dropdown_phone_input__button_billing_modal"
                      // data-dropdown-toggle="dropdown_phone_input_billing_modal" // Usar estado/onClick
                      className="z-10 inline-flex shrink-0 items-center rounded-s-lg border border-gray-300 bg-gray-100 px-4 py-2.5 text-center text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-700"
                      type="button"
                    >
                      <svg
                        fill="none"
                        aria-hidden="true"
                        className="me-2 h-4 w-4"
                        viewBox="0 0 20 15"
                      >
                        {/* SVG Bandeira US */}
                        <rect
                          width="19.6"
                          height="14"
                          y=".5"
                          fill="#fff"
                          rx="2"
                        />
                        <mask
                          id="a-modal"
                          style={{ maskType: "luminance" }}
                          width="20"
                          height="15"
                          x="0"
                          y="0"
                          maskUnits="userSpaceOnUse"
                        >
                          <rect
                            width="19.6"
                            height="14"
                            y=".5"
                            fill="#fff"
                            rx="2"
                          />
                        </mask>
                        <g mask="url(#a-modal)">
                          <path
                            fill="#D02F44"
                            fillRule="evenodd"
                            d="M19.6.5H0v.933h19.6V.5zm0 1.867H0V3.3h19.6v-.933zM0 4.233h19.6v.934H0v-.934zM19.6 6.1H0v.933h19.6V6.1zM0 7.967h19.6V8.9H0v-.933zm19.6 1.866H0v.934h19.6v-.934zM0 11.7h19.6v.933H0V11.7zm19.6 1.867H0v.933h19.6v-.933z"
                            clipRule="evenodd"
                          />
                          <path fill="#46467F" d="M0 .5h8.4v6.533H0z" />
                          <g filter="url(#filter0_d_343_121520_modal)">
                            {" "}
                            {/* ID do filtro precisa ser único */}
                            <path
                              fill="url(#paint0_linear_343_121520_modal)"
                              fillRule="evenodd"
                              d="M1.867 1.9a.467.467 0 11-.934 0 .467.467 0 01.934 0zm1.866 0a.467.467 0 11-.933 0 .467.467 0 01.933 0zm1.4.467a.467.467 0 100-.934.467.467 0 000 .934zM7.467 1.9a.467.467 0 11-.934 0 .467.467 0 01.934 0zM2.333 3.3a.467.467 0 100-.933.467.467 0 000 .933zm2.334-.467a.467.467 0 11-.934 0 .467.467 0 01.934 0zm1.4.467a.467.467 0 100-.933.467.467 0 000 .933zm1.4.467a.467.467 0 11-.934 0 .467.467 0 01.934 0zm-2.334.466a.467.467 0 100-.933.467.467 0 000 .933zm-1.4-.466a.467.467 0 11-.933 0 .467.467 0 01.933 0zM1.4 4.233a.467.467 0 100-.933.467.467 0 000 .933zm1.4.467a.467.467 0 11-.933 0 .467.467 0 01.933 0zm1.4.467a.467.467 0 100-.934.467.467 0 000 .934zM6.533 4.7a.467.467 0 11-.933 0 .467.467 0 01.933 0zM7 6.1a.467.467 0 100-.933.467.467 0 000 .933zm-1.4-.467a.467.467 0 11-.933 0 .467.467 0 01.933 0zM3.267 6.1a.467.467 0 100-.933.467.467 0 000 .933zm-1.4-.467a.467.467 0 11-.934 0 .467.467 0 01.934 0z"
                              clipRule="evenodd"
                            />
                          </g>
                        </g>
                        <defs>
                          <linearGradient
                            id="paint0_linear_343_121520_modal"
                            x1=".933"
                            x2=".933"
                            y1="1.433"
                            y2="6.1"
                            gradientUnits="userSpaceOnUse"
                          >
                            <stop stopColor="#fff" />
                            <stop offset="1" stopColor="#F0F0F0" />
                          </linearGradient>
                          <filter
                            id="filter0_d_343_121520_modal"
                            width="6.533"
                            height="5.667"
                            x=".933"
                            y="1.433"
                            colorInterpolationFilters="sRGB"
                            filterUnits="userSpaceOnUse"
                          >
                            <feFlood
                              floodOpacity="0"
                              result="BackgroundImageFix"
                            />
                            <feColorMatrix
                              in="SourceAlpha"
                              result="hardAlpha"
                              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                            />
                            <feOffset dy="1" />
                            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0" />
                            <feBlend
                              in2="BackgroundImageFix"
                              result="effect1_dropShadow_343_121520"
                            />
                            <feBlend
                              in="SourceGraphic"
                              in2="effect1_dropShadow_343_121520"
                              result="shape"
                            />
                          </filter>
                        </defs>
                      </svg>
                      +1
                      <svg
                        className="-me-0.5 ms-2 h-4 w-4"
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
                          d="m19 9-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {/* Conteúdo Dropdown (precisaria de estado/lógica) */}
                    <div
                      id="dropdown_phone_input_billing_modal"
                      className="z-10 hidden w-56 divide-y divide-gray-100 rounded-lg bg-white shadow dark:bg-gray-700"
                    >
                      {/* ... Lista de países ... */}
                    </div>
                    {/* Input Telefone */}
                    <div className="relative w-full">
                      <input
                        type="text"
                        id="phone-input_billing_modal"
                        className="z-20 block w-full rounded-e-lg border border-s-0 border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:border-s-gray-700 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:focus:border-primary-500"
                        pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
                        placeholder="123-456-7890"
                        required
                      />
                    </div>
                  </div>
                </div>
                {/* TODO: Adicionar outros campos do modal (Endereço, Cidade, etc.) se existirem no HTML original completo */}
              </div>

              {/* Botão Salvar no Modal */}
              <button
                type="submit"
                className="w-full rounded-lg bg-primary-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-primary-800 focus:outline-none focus:ring-4 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800"
              >
                Save all
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
