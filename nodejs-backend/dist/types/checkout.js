"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHECKOUT_CONFLICT_CODES = void 0;
// Internal diagnostic categories; not fields of the public checkout DTO.
exports.CHECKOUT_CONFLICT_CODES = [
    "BUSINESS_CONFLICT",
    "CART_EMPTY",
    "INSUFFICIENT_STOCK",
    "PRODUCT_UNAVAILABLE",
    "INVALID_QUANTITY",
    "IDEMPOTENCY_PROCESSING",
    "IDEMPOTENCY_FINGERPRINT_MISMATCH",
    "IDEMPOTENCY_STATE_CONFLICT",
    "PRODUCT_NOT_FOUND",
    "SELLER_NOT_FOUND",
    "INVENTORY_UNAVAILABLE",
    "UNSUPPORTED_CURRENCY",
];
