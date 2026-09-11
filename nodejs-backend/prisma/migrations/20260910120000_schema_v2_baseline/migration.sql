-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'SELLER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('BRL');

-- CreateEnum
CREATE TYPE "category" AS ENUM ('OFFICE', 'SPORTS', 'BOOKS', 'BEAUTY', 'CLOTHING', 'TOYS', 'TV_PROJECTORS', 'SMARTPHONES_TABLETS', 'ELECTRONICS', 'PETS', 'FURNITURE');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SellerOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'PAYPAL');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'PROCESSING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'DECLINED', 'FAILED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('RESTOCK', 'RESERVATION', 'SALE_COMMIT', 'RELEASE', 'RETURN', 'MANUAL_CORRECTION');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'COMMITTED', 'RELEASED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SEPARATED', 'PROCESSING', 'SHIPPED', 'COLLECTED', 'ARRIVED_AT_CENTER', 'DELIVERED', 'FAILED', 'RETURNED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_address" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'BR',
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "priceInCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'BRL',
    "category" "category" NOT NULL,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "onHandQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_reservation" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movement" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "movementType" "InventoryMovementType" NOT NULL,
    "onHandDelta" INTEGER NOT NULL,
    "reservedDelta" INTEGER NOT NULL,
    "onHandAfter" INTEGER NOT NULL,
    "reservedAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),

    CONSTRAINT "cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_item" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotalInCents" INTEGER NOT NULL,
    "shippingInCents" INTEGER NOT NULL DEFAULT 0,
    "taxInCents" INTEGER NOT NULL DEFAULT 0,
    "discountInCents" INTEGER NOT NULL DEFAULT 0,
    "totalInCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'BRL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_order" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "SellerOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotalInCents" INTEGER NOT NULL,
    "shippingInCents" INTEGER NOT NULL DEFAULT 0,
    "taxInCents" INTEGER NOT NULL DEFAULT 0,
    "discountInCents" INTEGER NOT NULL DEFAULT 0,
    "totalInCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "seller_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceInCents" INTEGER NOT NULL,
    "lineTotalInCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "productReferenceSnapshot" TEXT,
    "sellerNameSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_address" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sourceAddressId" TEXT,
    "recipientName" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_order_status_history" (
    "id" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "fromStatus" "SellerOrderStatus",
    "toStatus" "SellerOrderStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "amountInCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "payment_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund" (
    "id" TEXT NOT NULL,
    "paymentAttemptId" TEXT NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery" (
    "id" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "trackingCode" TEXT,
    "carrier" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'SEPARATED',
    "estimatedDelivery" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_status_history" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "fromStatus" "DeliveryStatus",
    "toStatus" "DeliveryStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "delivery_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "sellerId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_key" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "result" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "idempotency_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_normalizedEmail_key" ON "user"("normalizedEmail");

-- CreateIndex
CREATE INDEX "user_role_isActive_idx" ON "user"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "customer_userId_key" ON "customer"("userId");

-- CreateIndex
CREATE INDEX "customer_address_customerId_isActive_idx" ON "customer_address"("customerId", "isActive");

-- CreateIndex
CREATE INDEX "customer_address_customerId_isDefault_idx" ON "customer_address"("customerId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "seller_userId_key" ON "seller"("userId");

-- CreateIndex
CREATE INDEX "seller_isActive_storeName_idx" ON "seller"("isActive", "storeName");

-- CreateIndex
CREATE INDEX "product_sellerId_isActive_createdAt_idx" ON "product"("sellerId", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "product_category_isActive_createdAt_idx" ON "product"("category", "isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_sellerId_reference_key" ON "product"("sellerId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_productId_key" ON "inventory"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservation_orderItemId_key" ON "inventory_reservation"("orderItemId");

-- CreateIndex
CREATE INDEX "inventory_reservation_inventoryId_status_idx" ON "inventory_reservation"("inventoryId", "status");

-- CreateIndex
CREATE INDEX "inventory_reservation_status_expiresAt_idx" ON "inventory_reservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "inventory_movement_inventoryId_createdAt_idx" ON "inventory_movement"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movement_orderItemId_idx" ON "inventory_movement"("orderItemId");

-- CreateIndex
CREATE INDEX "cart_customerId_status_idx" ON "cart"("customerId", "status");

-- CreateIndex
CREATE INDEX "cart_item_cartId_createdAt_idx" ON "cart_item"("cartId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cart_item_cartId_productId_key" ON "cart_item"("cartId", "productId");

-- CreateIndex
CREATE INDEX "order_customerId_createdAt_idx" ON "order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "order_customerId_status_createdAt_idx" ON "order"("customerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "seller_order_sellerId_status_createdAt_idx" ON "seller_order"("sellerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "seller_order_orderId_createdAt_idx" ON "seller_order"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "seller_order_orderId_sellerId_key" ON "seller_order"("orderId", "sellerId");

-- CreateIndex
CREATE INDEX "order_item_sellerOrderId_idx" ON "order_item"("sellerOrderId");

-- CreateIndex
CREATE INDEX "order_item_productId_idx" ON "order_item"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "order_address_orderId_key" ON "order_address"("orderId");

-- CreateIndex
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "order_status_history"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "seller_order_status_history_sellerOrderId_createdAt_idx" ON "seller_order_status_history"("sellerOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_attempt_orderId_status_createdAt_idx" ON "payment_attempt"("orderId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempt_provider_providerReference_key" ON "payment_attempt"("provider", "providerReference");

-- CreateIndex
CREATE INDEX "refund_paymentAttemptId_status_createdAt_idx" ON "refund"("paymentAttemptId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "refund_paymentAttemptId_providerReference_key" ON "refund"("paymentAttemptId", "providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_sellerOrderId_key" ON "delivery"("sellerOrderId");

-- CreateIndex
CREATE INDEX "delivery_status_updatedAt_idx" ON "delivery"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "delivery_trackingCode_idx" ON "delivery"("trackingCode");

-- CreateIndex
CREATE INDEX "delivery_status_history_deliveryId_changedAt_idx" ON "delivery_status_history"("deliveryId", "changedAt");

-- CreateIndex
CREATE INDEX "review_productId_createdAt_idx" ON "review"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "review_sellerId_createdAt_idx" ON "review"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "review_userId_productId_key" ON "review"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "review_userId_sellerId_key" ON "review"("userId", "sellerId");

-- CreateIndex
CREATE INDEX "idempotency_key_operation_status_expiresAt_idx" ON "idempotency_key"("operation", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "idempotency_key_orderId_idx" ON "idempotency_key"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_key_userId_operation_key_key" ON "idempotency_key"("userId", "operation", "key");

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller" ADD CONSTRAINT "seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart" ADD CONSTRAINT "cart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_order" ADD CONSTRAINT "seller_order_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_order" ADD CONSTRAINT "seller_order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "seller_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_address" ADD CONSTRAINT "order_address_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_address" ADD CONSTRAINT "order_address_sourceAddressId_fkey" FOREIGN KEY ("sourceAddressId") REFERENCES "customer_address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_order_status_history" ADD CONSTRAINT "seller_order_status_history_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "seller_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempt" ADD CONSTRAINT "payment_attempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "payment_attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "seller_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_status_history" ADD CONSTRAINT "delivery_status_history_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Complementary SQL: partial uniqueness and database checks.

CREATE UNIQUE INDEX "cart_one_active_per_customer"
ON "cart" ("customerId")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "customer_address_one_default_active"
ON "customer_address" ("customerId")
WHERE "isDefault" = TRUE
  AND "isActive" = TRUE;

ALTER TABLE "product"
  ADD CONSTRAINT "product_price_non_negative"
    CHECK ("priceInCents" >= 0);

ALTER TABLE "cart_item"
  ADD CONSTRAINT "cart_item_quantity_positive"
    CHECK ("quantity" > 0);

ALTER TABLE "inventory"
  ADD CONSTRAINT "inventory_on_hand_non_negative"
    CHECK ("onHandQuantity" >= 0),
  ADD CONSTRAINT "inventory_reserved_non_negative"
    CHECK ("reservedQuantity" >= 0),
  ADD CONSTRAINT "inventory_reserved_not_above_on_hand"
    CHECK ("reservedQuantity" <= "onHandQuantity");

ALTER TABLE "inventory_reservation"
  ADD CONSTRAINT "inventory_reservation_quantity_positive"
    CHECK ("quantity" > 0);

ALTER TABLE "inventory_movement"
  ADD CONSTRAINT "inventory_movement_on_hand_after_non_negative"
    CHECK ("onHandAfter" >= 0),
  ADD CONSTRAINT "inventory_movement_reserved_after_non_negative"
    CHECK ("reservedAfter" >= 0),
  ADD CONSTRAINT "inventory_movement_reserved_after_not_above_on_hand"
    CHECK ("reservedAfter" <= "onHandAfter");

ALTER TABLE "order_item"
  ADD CONSTRAINT "order_item_quantity_positive"
    CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_item_unit_price_non_negative"
    CHECK ("unitPriceInCents" >= 0),
  ADD CONSTRAINT "order_item_line_total_non_negative"
    CHECK ("lineTotalInCents" >= 0),
  ADD CONSTRAINT "order_item_line_total_consistent"
    CHECK ("lineTotalInCents" = "quantity" * "unitPriceInCents");

ALTER TABLE "order"
  ADD CONSTRAINT "order_subtotal_non_negative"
    CHECK ("subtotalInCents" >= 0),
  ADD CONSTRAINT "order_shipping_non_negative"
    CHECK ("shippingInCents" >= 0),
  ADD CONSTRAINT "order_tax_non_negative"
    CHECK ("taxInCents" >= 0),
  ADD CONSTRAINT "order_discount_non_negative"
    CHECK ("discountInCents" >= 0),
  ADD CONSTRAINT "order_discount_within_gross_total"
    CHECK ("discountInCents" <=
      "subtotalInCents" + "shippingInCents" + "taxInCents"),
  ADD CONSTRAINT "order_total_consistent"
    CHECK ("totalInCents" =
      "subtotalInCents" + "shippingInCents" +
      "taxInCents" - "discountInCents");

ALTER TABLE "seller_order"
  ADD CONSTRAINT "seller_order_subtotal_non_negative"
    CHECK ("subtotalInCents" >= 0),
  ADD CONSTRAINT "seller_order_shipping_non_negative"
    CHECK ("shippingInCents" >= 0),
  ADD CONSTRAINT "seller_order_tax_non_negative"
    CHECK ("taxInCents" >= 0),
  ADD CONSTRAINT "seller_order_discount_non_negative"
    CHECK ("discountInCents" >= 0),
  ADD CONSTRAINT "seller_order_discount_within_gross_total"
    CHECK ("discountInCents" <=
      "subtotalInCents" + "shippingInCents" + "taxInCents"),
  ADD CONSTRAINT "seller_order_total_consistent"
    CHECK ("totalInCents" =
      "subtotalInCents" + "shippingInCents" +
      "taxInCents" - "discountInCents");

ALTER TABLE "payment_attempt"
  ADD CONSTRAINT "payment_attempt_amount_positive"
    CHECK ("amountInCents" > 0);

ALTER TABLE "refund"
  ADD CONSTRAINT "refund_amount_positive"
    CHECK ("amountInCents" > 0);

ALTER TABLE "review"
  ADD CONSTRAINT "review_exactly_one_target"
    CHECK (
      ("productId" IS NOT NULL AND "sellerId" IS NULL)
      OR
      ("productId" IS NULL AND "sellerId" IS NOT NULL)
    ),
  ADD CONSTRAINT "review_rating_range"
    CHECK ("rating" BETWEEN 1 AND 5);

