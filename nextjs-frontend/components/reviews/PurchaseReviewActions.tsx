"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/authContext";
import { ApiError } from "@/lib/http";
import {
  createProductReview,
  createSellerReview,
  getReview,
  updateReview,
} from "@/services/reviews";
import type { OrderItemV2, SellerOrderStatusV2 } from "@/types/ordersV2";
import type { ReviewDto, ReviewTargetKind } from "@/types/reviews";

type ReviewTarget = {
  kind: ReviewTargetKind;
  id: string;
  name: string;
};

type Props = {
  sellerOrderId: string;
  sellerId: string;
  sellerName: string;
  status: SellerOrderStatusV2;
  items: OrderItemV2[];
};

function savedReviewKey(userId: string, target: ReviewTarget) {
  return `marketplace.review.${userId}.${target.kind}.${target.id}`;
}

function errorMessage(error: unknown, editing: boolean) {
  if (!(error instanceof ApiError)) {
    return "Não foi possível concluir a operação. Confira sua conexão e tente novamente.";
  }
  switch (error.status) {
    case 400:
      return "A nota ou o comentário é inválido. Use uma nota de 1 a 5 e um comentário de até 2.000 caracteres.";
    case 401:
      return "Sua sessão expirou. Entre novamente para continuar.";
    case 403:
      return editing
        ? "A API não autorizou a edição desta avaliação. Somente o autor pode alterá-la."
        : "A API não confirmou uma compra entregue elegível para esta avaliação.";
    case 404:
      return "O recurso da avaliação não foi encontrado.";
    case 409:
      return "Você já enviou uma avaliação para este alvo. " +
        "Se o ID estiver disponível nesta sessão, você poderá editá-la.";
    default:
      return error.message;
  }
}

function ReviewEditor({ target, userId }: { target: ReviewTarget; userId: string }) {
  const targetKind = target.kind;
  const targetId = target.id;
  const targetName = target.name;
  const [review, setReview] = useState<ReviewDto | null>(null);
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingSaved(true);
    setReview(null);
    setRating("5");
    setComment("");
    const currentTarget = { kind: targetKind, id: targetId, name: targetName };
    const storageKey = savedReviewKey(userId, currentTarget);
    const reviewId = window.sessionStorage.getItem(storageKey);
    if (!reviewId) {
      setLoadingSaved(false);
      return () => {
        active = false;
      };
    }

    getReview(reviewId)
      .then((result) => {
        const targetMatches = targetKind === "product"
          ? result.productId === targetId && result.sellerId === null
          : result.sellerId === targetId && result.productId === null;
        if (!active) return;
        if (!targetMatches) {
          window.sessionStorage.removeItem(storageKey);
          return;
        }
        setReview(result);
        setRating(String(result.rating));
        setComment(result.comment ?? "");
      })
      .catch(() => {
        if (active) window.sessionStorage.removeItem(storageKey);
      })
      .finally(() => {
        if (active) setLoadingSaved(false);
      });

    return () => {
      active = false;
    };
  }, [targetId, targetKind, targetName, userId]);

  const submit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const input = { rating: Number(rating), comment: comment.trim() || null };
    const currentTarget = { kind: targetKind, id: targetId, name: targetName };
    try {
      const result = review
        ? await updateReview(review.id, input)
        : targetKind === "product"
          ? await createProductReview(targetId, input)
          : await createSellerReview(targetId, input);
      setReview(result);
      setRating(String(result.rating));
      setComment(result.comment ?? "");
      window.sessionStorage.setItem(savedReviewKey(userId, currentTarget), result.id);
      setMessage(review ? "Avaliação atualizada." : "Avaliação enviada.");
    } catch (requestError) {
      setError(errorMessage(requestError, Boolean(review)));
    } finally {
      setSubmitting(false);
    }
  }, [comment, rating, review, submitting, targetId, targetKind, targetName, userId]);

  if (loadingSaved) {
    return <p className="text-sm" role="status">Verificando avaliação desta sessão…</p>;
  }

  return (
    <form className="space-y-3 rounded border p-4" onSubmit={submit}>
      <h4 className="font-medium">
        {review ? `Editar sua avaliação de ${target.name}` : `Avaliar ${target.name}`}
      </h4>
      <label className="grid max-w-xs gap-1 text-sm">
        Nota
        <select
          aria-label={`Nota para ${target.name}`}
          className="h-10 rounded-md border bg-background px-3"
          value={rating}
          onChange={(event) => setRating(event.target.value)}
          disabled={submitting}
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>{value} / 5</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Comentário (opcional)
        <textarea
          className="min-h-24 rounded-md border bg-background p-3"
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          disabled={submitting}
        />
        <span className="text-xs text-muted-foreground">{comment.length}/2000</span>
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      <Button type="submit" disabled={submitting || loadingSaved}>
        {submitting ? "Enviando…" : review ? "Salvar avaliação" : "Enviar avaliação"}
      </Button>
      <p className="text-xs text-muted-foreground">
        A API valida a autoria, a compra entregue e a unicidade; a interface não garante elegibilidade.
      </p>
    </form>
  );
}

export function PurchaseReviewActions({
  sellerOrderId,
  sellerId,
  sellerName,
  status,
  items,
}: Props) {
  const { user } = useAuth();

  if (status !== "DELIVERED") {
    return (
      <p className="text-sm text-muted-foreground">
        As avaliações podem ser solicitadas após a entrega do SellerOrder.
      </p>
    );
  }
  if (user?.role !== "CUSTOMER") {
    return <p className="text-sm text-muted-foreground">Ações de avaliação disponíveis somente ao customer.</p>;
  }

  const uniqueItems = items.filter(
    (item, index, all) => all.findIndex((candidate) => candidate.productId === item.productId) === index,
  );

  return (
    <section className="space-y-4 border-t pt-4" aria-label={`Avaliações da compra ${sellerOrderId}`}>
      <h3 className="text-lg font-semibold">Avaliar esta compra entregue</h3>
      {uniqueItems.map((item) => (
        <ReviewEditor
          key={`${user.id}-product-${item.productId}`}
          userId={user.id}
          target={{ kind: "product", id: item.productId, name: item.productNameSnapshot }}
        />
      ))}
      <ReviewEditor
        key={`${user.id}-seller-${sellerId}`}
        userId={user.id}
        target={{ kind: "seller", id: sellerId, name: sellerName }}
      />
    </section>
  );
}
