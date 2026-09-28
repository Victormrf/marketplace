"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/http";
import {
  isIdempotencyProcessingConflict,
  shouldClearPendingAttempt,
} from "@/lib/checkoutAttempt";
import { getCart } from "@/services/cart";
import { listCustomerAddresses } from "@/services/customerAddress";
import { submitCheckout } from "@/services/checkout";
import type { CartDto } from "@/types/cart";
import type { CustomerAddressDto } from "@/types/customerAddress";

const STORAGE_KEY_PREFIX = "marketplace.checkout.pending.v2";
const COMPLETED_ORDER_KEY_PREFIX = "marketplace.checkout.completedOrderId";

type PendingAttempt = {
  key: string;
  addressId: string;
};

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Sua sessão expirou. Entre novamente para continuar.";
    }
    if (error.status === 403) {
      return "Sua conta não tem permissão para finalizar esta compra.";
    }
    if (error.status === 404) {
      return "O endereço ou o carrinho não está mais disponível.";
    }
    if (isIdempotencyProcessingConflict(error)) {
      return "Este checkout ainda está sendo processado. Aguarde alguns instantes e tente novamente; a mesma tentativa será mantida.";
    }
    if (error.status === 409) {
      return "O checkout foi recusado (409). Estoque, endereço ou tentativa idempotente pode ter mudado. Confira os dados e tente uma nova tentativa após resolver o conflito.";
    }
    return error.message;
  }
  return "Não foi possível confirmar o resultado. A tentativa foi mantida; tente novamente para consultar o mesmo checkout com a mesma chave.";
}

export function useCheckout(userId: string | null) {
  const enabled = userId !== null;
  const storageKey = userId
    ? `${STORAGE_KEY_PREFIX}:${userId}`
    : STORAGE_KEY_PREFIX;
  const completedOrderKey = userId
    ? `${COMPLETED_ORDER_KEY_PREFIX}:${userId}`
    : COMPLETED_ORDER_KEY_PREFIX;
  const [cart, setCart] = useState<CartDto | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddressDto[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [pending, setPending] = useState<PendingAttempt | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setCart(null);
      setAddresses([]);
      setPending(null);
      setSelectedAddressId("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setCart(null);
    setAddresses([]);
    setPending(null);
    setSelectedAddressId("");
    setLoading(true);
    const stored = sessionStorage.getItem(storageKey);
    let restored: PendingAttempt | null = null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<PendingAttempt>;
        if (
          typeof parsed.key === "string" &&
          typeof parsed.addressId === "string"
        ) {
          restored = { key: parsed.key, addressId: parsed.addressId };
        }
      } catch {
        setError(
          "A tentativa salva no navegador não pôde ser lida. Ela não foi apagada automaticamente.",
        );
      }
    }
    if (restored) {
      setPending(restored);
      setSelectedAddressId(restored.addressId);
    }

    const loadCheckoutData = restored
      ? listCustomerAddresses(1, 100).then((addressPage) => ({
          currentCart: null,
          addressPage,
        }))
      : Promise.all([getCart(), listCustomerAddresses(1, 100)]).then(
          ([currentCart, addressPage]) => ({ currentCart, addressPage }),
        );

    void loadCheckoutData
      .then(({ currentCart, addressPage }) => {
        if (cancelled) return;
        setCart(currentCart);
        setAddresses(addressPage.data);
        if (!restored) {
          setSelectedAddressId(
            addressPage.data.find((address) => address.isDefault)?.id ??
              addressPage.data[0]?.id ??
              "",
          );
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, storageKey]);

  const submit = useCallback(async () => {
    if (!enabled || !userId || submittingRef.current) return;
    const addressId = pending?.addressId ?? selectedAddressId;
    if (!addressId) {
      setError("Selecione um endereço de entrega.");
      return;
    }
    if (!pending && !cart?.items.length) {
      setError("Seu carrinho está vazio.");
      return;
    }
    if (
      !pending &&
      cart?.items.some((item) => !item.isAvailable || !item.hasSufficientStock)
    ) {
      setError("Há itens indisponíveis ou com estoque insuficiente. Revise o carrinho antes de continuar.");
      return;
    }

    const attempt = pending ?? {
      key: crypto.randomUUID(),
      addressId,
    };
    if (!pending) {
      sessionStorage.setItem(storageKey, JSON.stringify(attempt));
      setPending(attempt);
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const order = await submitCheckout(attempt.addressId, attempt.key);
      sessionStorage.setItem(completedOrderKey, order.id);
      sessionStorage.removeItem(storageKey);
      setPending(null);
      window.location.assign(
        `/cart/order-confirmation?orderId=${encodeURIComponent(order.id)}`,
      );
    } catch (requestError) {
      setError(errorMessage(requestError));
      if (
        requestError instanceof ApiError &&
        shouldClearPendingAttempt(requestError)
      ) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [cart, completedOrderKey, enabled, pending, selectedAddressId, storageKey, userId]);

  return {
    addresses,
    cart,
    error,
    loading,
    pending,
    selectedAddressId,
    setSelectedAddressId,
    submit,
    submitting,
  };
}
