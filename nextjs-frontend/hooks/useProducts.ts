import { useEffect, useState } from "react";
import { ApiError } from "@/lib/http";
import { listProducts } from "@/services/catalog";
import type { ProductCollectionDto } from "@/types/product";

export function useProducts(query: URLSearchParams) {
  const queryKey = query.toString();
  const [collection, setCollection] =
    useState<ProductCollectionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    listProducts(new URLSearchParams(queryKey))
      .then((result) => {
        if (active) {
          setCollection(result);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return;

        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Não foi possível carregar os produtos.",
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [queryKey]);

  return { collection, loading, error };
}
