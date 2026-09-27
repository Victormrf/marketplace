import { useEffect, useState } from "react";
import { ApiError } from "@/lib/http";
import { listSellerProducts } from "@/services/catalog";
import {
  adjustInventory,
  getInventory,
  listInventoryMovements,
  restockInventory,
  type InventoryDto,
  type InventoryMovementCollectionDto,
} from "@/services/inventory";
import { getMySellerProfile } from "@/services/seller";
import type { ProductReadDto } from "@/types/product";

function messageFor(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Sua sessão expirou. Entre novamente.";
    }
    if (error.status === 403) {
      return "Você não tem autorização para gerenciar este inventário.";
    }
    return error.message;
  }

  return "Não foi possível concluir a operação.";
}

export function useSellerInventory(enabled: boolean) {
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductReadDto[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [inventory, setInventory] = useState<InventoryDto | null>(null);
  const [movements, setMovements] =
    useState<InventoryMovementCollectionDto | null>(null);
  const [movementPage, setMovementPage] = useState(1);
  const [profileLoading, setProfileLoading] = useState(enabled);
  const [productsLoading, setProductsLoading] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setProfileLoading(false);
      return;
    }

    let active = true;
    setProfileLoading(true);
    setError(null);

    getMySellerProfile()
      .then((seller) => {
        if (active) {
          setSellerId(seller.id);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(messageFor(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setProfileLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!sellerId) return;

    let active = true;
    setProductsLoading(true);
    setError(null);

    listSellerProducts(
      sellerId,
      new URLSearchParams({ page: String(productPage), limit: "100" }),
    )
      .then((result) => {
        if (!active) return;

        setProducts(result.data);
        setProductTotalPages(result.pagination.totalPages);
        setSelectedProductId((current) =>
          result.data.some((product) => product.id === current)
            ? current
            : result.data[0]?.id ?? "",
        );
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(messageFor(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setProductsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [sellerId, productPage]);

  useEffect(() => {
    if (!selectedProductId) {
      setInventory(null);
      setMovements(null);
      return;
    }

    let active = true;
    setInventoryLoading(true);
    setError(null);

    Promise.all([
      getInventory(selectedProductId),
      listInventoryMovements(selectedProductId, {
        page: movementPage,
        limit: 10,
      }),
    ])
      .then(([currentInventory, currentMovements]) => {
        if (!active) return;

        setInventory(currentInventory);
        setMovements(currentMovements);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(messageFor(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setInventoryLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedProductId, movementPage]);

  async function submitMovement(
    kind: "restock" | "adjustment",
    quantity: number,
    delta: number,
    reason: string,
  ) {
    if (!selectedProductId) return false;

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const updatedInventory =
        kind === "restock"
          ? await restockInventory(
              selectedProductId,
              quantity,
              reason.trim() || undefined,
            )
          : await adjustInventory(selectedProductId, delta, reason);

      setInventory(updatedInventory);
      setNotice(
        kind === "restock"
          ? "Reposição registrada."
          : "Ajuste registrado.",
      );

      const refreshedMovements = await listInventoryMovements(
        selectedProductId,
        { page: 1, limit: 10 },
      );
      setMovementPage(1);
      setMovements(refreshedMovements);
      return true;
    } catch (requestError) {
      setError(messageFor(requestError));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    error,
    inventory,
    loading: profileLoading || productsLoading || inventoryLoading,
    movementPage,
    movements,
    notice,
    productPage,
    productTotalPages,
    products,
    selectedProductId,
    setMovementPage,
    setProductPage,
    setSelectedProductId,
    submitMovement,
  };
}
