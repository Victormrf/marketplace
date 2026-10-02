import Link from "next/link";

export default function WishlistPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Favoritos indisponíveis</h1>
      <p role="status">
        A lista de favoritos ainda não está disponível nesta versão. Você pode
        continuar explorando o catálogo.
      </p>
      <Link className="underline" href="/products">
        Ver produtos
      </Link>
    </main>
  );
}
