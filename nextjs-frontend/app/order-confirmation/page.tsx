// app/order-confirmation/page.tsx (ou o caminho desejado)

import React from "react";

// Nota: Os dados exibidos nesta página (número do pedido, data, nome, etc.)
// são estáticos, conforme o HTML original. Em uma aplicação real,
// esses dados seriam dinâmicos, provavelmente recebidos como props ou
// buscados de uma API após a conclusão do pedido.

export default function OrderConfirmationPage() {
  // Exemplo de como os dados poderiam ser recebidos (se fossem dinâmicos):
  // const orderNumber = props.orderNumber || "#7564804";
  // const orderDate = props.orderDate || "14 May 2024"; // A data é do HTML original
  // const paymentMethod = props.paymentMethod || "JPMorgan monthly installments";
  // const customerName = props.customerName || "Flowbite Studios LLC";
  // const address = props.address || "34 Scott Street, San Francisco, California, USA";
  // const phone = props.phone || "+(123) 456 7890";

  return (
    <section className="bg-white py-8 antialiased dark:bg-gray-900 md:py-16">
      <div className="mx-auto max-w-2xl px-4 2xl:px-0">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl mb-2">
          Thanks for your order!
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 md:mb-8">
          {/* O número do pedido seria dinâmico */}
          Your order{" "}
          <a
            href="#"
            className="font-medium text-gray-900 dark:text-white hover:underline"
          >
            #7564804
          </a>{" "}
          will be processed within 24 hours during working days. We will notify
          you by email once your order has been shipped.
        </p>

        {/* --- Detalhes do Pedido --- */}
        <div className="space-y-4 sm:space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800 mb-6 md:mb-8">
          <dl className="sm:flex items-center justify-between gap-4">
            <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">
              Date
            </dt>
            {/* A data seria dinâmica */}
            <dd className="font-medium text-gray-900 dark:text-white sm:text-end">
              14 May 2024
            </dd>
          </dl>
          <dl className="sm:flex items-center justify-between gap-4">
            <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">
              Payment Method
            </dt>
            {/* O método de pagamento seria dinâmico */}
            <dd className="font-medium text-gray-900 dark:text-white sm:text-end">
              JPMorgan monthly installments
            </dd>
          </dl>
          <dl className="sm:flex items-center justify-between gap-4">
            <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">
              Name
            </dt>
            {/* O nome seria dinâmico */}
            <dd className="font-medium text-gray-900 dark:text-white sm:text-end">
              Flowbite Studios LLC
            </dd>
          </dl>
          <dl className="sm:flex items-center justify-between gap-4">
            <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">
              Address
            </dt>
            {/* O endereço seria dinâmico */}
            <dd className="font-medium text-gray-900 dark:text-white sm:text-end">
              34 Scott Street, San Francisco, California, USA
            </dd>
          </dl>
          <dl className="sm:flex items-center justify-between gap-4">
            <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">
              Phone
            </dt>
            {/* O telefone seria dinâmico */}
            <dd className="font-medium text-gray-900 dark:text-white sm:text-end">
              +(123) 456 7890
            </dd>
          </dl>
        </div>

        {/* --- Botões de Ação --- */}
        <div className="flex items-center space-x-4">
          {/* Links seriam dinâmicos, apontando para a página de rastreio real ou página inicial */}
          <a
            href="#"
            className="text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-primary-600 dark:hover:bg-primary-700 focus:outline-none dark:focus:ring-primary-800"
          >
            Track your order
          </a>
          <a
            href="#"
            className="py-2.5 px-5 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-primary-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700"
          >
            Return to shopping
          </a>
        </div>
      </div>
    </section>
  );
}
