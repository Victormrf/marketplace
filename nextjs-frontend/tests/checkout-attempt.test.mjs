import assert from "node:assert/strict";
import test from "node:test";
import {
  isIdempotencyProcessingConflict,
  shouldClearPendingAttempt,
} from "../lib/checkoutAttempt.ts";

test("processing conflict preserves the pending attempt for an identical retry", () => {
  const storage = new Map();
  const storageKey = "marketplace.checkout.pending.v2:customer-test";
  const attempt = {
    key: "checkout-key-stable",
    addressId: "address-stable",
  };
  storage.set(storageKey, JSON.stringify(attempt));

  const processingError = {
    status: 409,
    body: { error: "Idempotency key is processing" },
  };

  assert.equal(isIdempotencyProcessingConflict(processingError), true);
  assert.equal(shouldClearPendingAttempt(processingError), false);

  if (shouldClearPendingAttempt(processingError)) {
    storage.delete(storageKey);
  }

  const retryAttempt = JSON.parse(storage.get(storageKey));
  assert.deepEqual(retryAttempt, attempt);
  assert.equal(retryAttempt.key, attempt.key);
  assert.equal(retryAttempt.addressId, attempt.addressId);
});

test("other 409 conflicts clear the pending attempt", () => {
  const stockConflict = {
    status: 409,
    body: { error: "Cart stock is insufficient" },
  };

  assert.equal(isIdempotencyProcessingConflict(stockConflict), false);
  assert.equal(shouldClearPendingAttempt(stockConflict), true);
});
