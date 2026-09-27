import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/http";
import {
  createCustomerAddress,
  deactivateCustomerAddress,
  listCustomerAddresses,
  setDefaultCustomerAddress,
  updateCustomerAddress,
} from "@/services/customerAddress";
import type {
  CustomerAddressCollectionDto,
  CustomerAddressInput,
  CustomerAddressUpdateInput,
} from "@/types/customerAddress";

function messageFor(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
    if (error.status === 403) return "Você não tem permissão para alterar endereços.";
    if (error.status === 404) return "O endereço não está mais disponível.";
    if (error.status === 409) return "O endereço entrou em conflito com uma alteração recente.";
    return error.message;
  }

  return "Não foi possível concluir a operação de endereço.";
}

export function useCustomerAddresses(enabled: boolean) {
  const [collection, setCollection] =
    useState<CustomerAddressCollectionDto | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(enabled);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);
    try {
      setCollection(await listCustomerAddresses(page, 20));
    } catch (requestError) {
      setError(messageFor(requestError));
    } finally {
      setLoading(false);
    }
  }, [enabled, page]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void loadAddresses();
  }, [enabled, loadAddresses]);

  const mutate = useCallback(
    async (operation: () => Promise<unknown>) => {
      setMutating(true);
      setError(null);
      try {
        await operation();
        await loadAddresses();
        return true;
      } catch (requestError) {
        setError(messageFor(requestError));
        return false;
      } finally {
        setMutating(false);
      }
    },
    [loadAddresses],
  );

  return {
    addresses: collection?.data ?? [],
    collection,
    create: (input: CustomerAddressInput) =>
      mutate(() => createCustomerAddress(input)),
    deactivate: (addressId: string) =>
      mutate(() => deactivateCustomerAddress(addressId)),
    error,
    loading,
    mutating,
    page,
    setDefault: (addressId: string) =>
      mutate(() => setDefaultCustomerAddress(addressId)),
    setPage,
    update: (addressId: string, input: CustomerAddressUpdateInput) =>
      mutate(() => updateCustomerAddress(addressId, input)),
  };
}
