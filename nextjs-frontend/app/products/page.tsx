import { Suspense } from "react";
import ProductsPageClient from "./productsPageClient";

export default function ProductsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProductsPageClient />
    </Suspense>
  );
}
