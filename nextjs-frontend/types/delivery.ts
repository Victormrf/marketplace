export type DeliveryStatusV2 =
  | "SEPARATED"
  | "PROCESSING"
  | "SHIPPED"
  | "COLLECTED"
  | "ARRIVED_AT_CENTER"
  | "DELIVERED"
  | "FAILED"
  | "RETURNED";

export type DeliveryDto = {
  id: string;
  sellerOrderId: string;
  trackingCode: string | null;
  carrier: string | null;
  status: DeliveryStatusV2;
  estimatedDelivery: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryStatusHistoryDto = {
  id: string;
  deliveryId: string;
  fromStatus: DeliveryStatusV2 | null;
  toStatus: DeliveryStatusV2;
  changedAt: string;
  reason: string | null;
};

export type CreateDeliveryInput = {
  trackingCode?: string;
  carrier?: string;
  estimatedDelivery?: string;
};

export type UpdateDeliveryTrackingInput = {
  trackingCode?: string;
  carrier?: string;
  estimatedDelivery?: string | null;
};

export type UpdateDeliveryStatusInput = {
  status: DeliveryStatusV2;
  reason?: string;
};
