import Link from "next/link";

export default function CustomersPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Clientes indisponíveis</h1>
      <p role="status">
        O backend atual não disponibiliza uma consulta de clientes do seller.
        Nenhum dado de cliente é exibido nesta página.
      </p>
      <Link className="underline" href="/">
        Voltar ao início
      </Link>
    </main>
  );
}
