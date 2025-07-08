export enum DeliveryStatus {
  SEPARATED = "SEPARATED",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  COLLECTED = "COLLECTED",
  ARRIVED_AT_CENTER = "ARRIVED_AT_CENTER",
  DELIVERED = "DELIVERED",
}

export type Delivery = {
  id: string;
  orderId: string;
  trackingCode?: string;
  carrier?: string;
  status: DeliveryStatus;
  estimatedDelivery?: string;
  deliveredAt?: string;
  updatedAt: string;
};
