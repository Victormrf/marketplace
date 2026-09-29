"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";
import { listProductReviews, listSellerReviews } from "@/services/reviews";
import type {
  ReviewCollectionDto,
  ReviewTargetKind,
} from "@/types/reviews";

type Props = {
  targetKind: ReviewTargetKind;
  targetId: string;
  targetName: string;
};

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 404) {
    return "Este produto ou seller não está disponível para consulta.";
  }
  if (error instanceof ApiError && error.status === 400) {
    return "O filtro ou a paginação enviados são inválidos.";
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível carregar as avaliações.";
}

export function ReviewCollection({ targetKind, targetId, targetName }: Props) {
  const [collection, setCollection] = useState<ReviewCollectionDto | null>(null);
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const filters = {
      page,
      limit: 5,
      ...(rating ? { rating: Number(rating) } : {}),
    };
    const request = targetKind === "product"
      ? listProductReviews(targetId, filters)
      : listSellerReviews(targetId, filters);

    request
      .then((result) => {
        if (active) setCollection(result);
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, rating, targetId, targetKind]);

  function changeRating(value: string) {
    setRating(value);
    setPage(1);
  }

  return (
    <section className="space-y-3 rounded border p-4" aria-label={`Avaliações: ${targetName}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Avaliações de {targetName}</h3>
          <p className="text-sm text-muted-foreground">
            {collection?.reputation.averageRating === null || !collection
              ? "Sem média de avaliações"
              : `${collection.reputation.averageRating.toFixed(1)} / 5`}
            {collection ? ` · ${collection.reputation.totalReviews} avaliação(ões)` : ""}
          </p>
        </div>
        <label className="grid gap-1 text-sm">
          Filtrar por nota
          <select
            aria-label={`Filtrar avaliações de ${targetName} por nota`}
            className="h-9 rounded-md border bg-background px-2"
            value={rating}
            onChange={(event) => changeRating(event.target.value)}
          >
            <option value="">Todas</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>{value} estrelas</option>
            ))}
          </select>
        </label>
      </div>

      {collection && (
        <div
          className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
          aria-label="Distribuição das avaliações"
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <span key={value}>
              {value}★: {collection.reputation.distribution[
                String(value) as "1" | "2" | "3" | "4" | "5"
              ]}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <p role="status">Carregando avaliações…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : collection?.data.length ? (
        <ul className="space-y-3">
          {collection.data.map((review) => (
            <li key={review.id} className="border-t pt-3">
              <p className="font-medium">{review.rating} / 5</p>
              <p className="whitespace-pre-wrap text-sm">
                {review.comment || "Sem comentário."}
              </p>
              <time className="text-xs text-muted-foreground" dateTime={review.createdAt}>
                {new Date(review.createdAt).toLocaleDateString("pt-BR")}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Ainda não há avaliações para este filtro.</p>
      )}

      {collection && collection.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-3">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm">
            Página {collection.pagination.page} de {collection.pagination.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= collection.pagination.totalPages || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}
