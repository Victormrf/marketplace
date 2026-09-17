import type { DeliveryStatus } from "@prisma/client";

export type DeliveryDto = {
  id: string;
  sellerOrderId: string;
  trackingCode: string | null;
  carrier: string | null;
  status: DeliveryStatus;
  estimatedDelivery: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DeliveryStatusHistoryDto = {
  id: string;
  deliveryId: string;
  fromStatus: DeliveryStatus | null;
  toStatus: DeliveryStatus;
  changedAt: Date;
  reason: string | null;
};

export type DeliveryTrackingInput = {
  trackingCode?: string | null;
  carrier?: string | null;
  estimatedDelivery?: Date | null;
};

export type DeliveryStatusInput = {
  status: DeliveryStatus;
  reason?: string | null;
};
