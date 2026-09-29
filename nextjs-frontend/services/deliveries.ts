import { browserRequest } from "@/lib/http";
import type {
  CreateDeliveryInput,
  DeliveryDto,
  DeliveryStatusHistoryDto,
  UpdateDeliveryStatusInput,
  UpdateDeliveryTrackingInput,
} from "@/types/delivery";

export function getDeliveryForSellerOrder(sellerOrderId: string) {
  return browserRequest<DeliveryDto>(
    `/api/seller-orders/${encodeURIComponent(sellerOrderId)}/delivery`,
  );
}

export function createDelivery(
  sellerOrderId: string,
  input: CreateDeliveryInput = {},
) {
  return browserRequest<DeliveryDto>(
    `/api/seller-orders/${encodeURIComponent(sellerOrderId)}/delivery`,
    { method: "POST", json: input },
  );
}

export function getDelivery(deliveryId: string) {
  return browserRequest<DeliveryDto>(
    `/api/deliveries/${encodeURIComponent(deliveryId)}`,
  );
}

export function getDeliveryHistory(deliveryId: string) {
  return browserRequest<DeliveryStatusHistoryDto[]>(
    `/api/deliveries/${encodeURIComponent(deliveryId)}/history`,
  );
}

export function updateDeliveryStatus(
  deliveryId: string,
  input: UpdateDeliveryStatusInput,
) {
  return browserRequest<DeliveryDto>(
    `/api/deliveries/${encodeURIComponent(deliveryId)}/status`,
    { method: "PATCH", json: input },
  );
}

export function updateDeliveryTracking(
  deliveryId: string,
  input: UpdateDeliveryTrackingInput,
) {
  return browserRequest<DeliveryDto>(
    `/api/deliveries/${encodeURIComponent(deliveryId)}/tracking`,
    { method: "PATCH", json: input },
  );
}
