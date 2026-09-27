import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/http";
import {
  addCartItem,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "@/services/cart";
import type { CartDto } from "@/types/cart";

function messageFor(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Entre como customer para consultar o carrinho.";
    if (error.status === 403) return "Somente customers podem operar o carrinho.";
    if (error.status === 404) return "O produto ou item do carrinho não está disponível.";
    if (error.status === 409) return "Estoque insuficiente ou produto indisponível. Revise a quantidade.";
    return error.message;
  }

  return "Não foi possível atualizar o carrinho.";
}

export function useCart(enabled: boolean) {
  const [cart, setCart] = useState<CartDto | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);
    try {
      setCart(await getCart());
    } catch (requestError) {
      setError(messageFor(requestError));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCart(null);
      setLoading(false);
      return;
    }

    void refresh();
  }, [enabled, refresh]);

  const applyMutation = useCallback(
    async (operation: () => Promise<CartDto | void>) => {
      setMutating(true);
      setError(null);
      try {
        const result = await operation();
        setCart(result ?? (await getCart()));
        return true;
      } catch (requestError) {
        setError(messageFor(requestError));
        return false;
      } finally {
        setMutating(false);
      }
    },
    [],
  );

  return {
    addItem: (productId: string, quantity: number) =>
      applyMutation(() => addCartItem({ productId, quantity })),
    cart,
    clear: () => applyMutation(clearCart),
    error,
    loading,
    mutating,
    refresh,
    removeItem: (productId: string) =>
      applyMutation(() => removeCartItem(productId)),
    updateItem: (productId: string, quantity: number) =>
      applyMutation(() => updateCartItem(productId, { quantity })),
  };
}
