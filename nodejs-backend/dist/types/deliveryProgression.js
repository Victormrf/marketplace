"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTOMATIC_DELIVERY_STATUSES = void 0;
exports.isAutomaticDeliveryStatus = isAutomaticDeliveryStatus;
exports.parseDeliveryProgressionJob = parseDeliveryProgressionJob;
exports.deliveryProgressionJobId = deliveryProgressionJobId;
const node_crypto_1 = require("node:crypto");
const customErrors_1 = require("../utils/customErrors");
exports.AUTOMATIC_DELIVERY_STATUSES = [
    "SEPARATED",
    "PROCESSING",
    "SHIPPED",
    "COLLECTED",
    "ARRIVED_AT_CENTER",
];
function isAutomaticDeliveryStatus(value) {
    return exports.AUTOMATIC_DELIVERY_STATUSES.some((status) => status === value);
}
function isIdentifier(value) {
    return (typeof value === "string" &&
        value.length > 0 &&
        value.length <= 255 &&
        !/[\s\u0000-\u001f\u007f]/.test(value));
}
function parseDeliveryProgressionJob(payload) {
    if (typeof payload !== "object" ||
        payload === null ||
        Array.isArray(payload)) {
        throw new customErrors_1.ValidationError("Invalid delivery progression payload");
    }
    const input = payload;
    const fields = [
        "version",
        "deliveryId",
        "expectedStatus",
        "expectedHistoryId",
        "eligibleBefore",
    ];
    const date = typeof input.eligibleBefore === "string"
        ? new Date(input.eligibleBefore)
        : new Date(NaN);
    if (Object.keys(input).length !== fields.length ||
        !fields.every((field) => Object.prototype.hasOwnProperty.call(input, field)) ||
        input.version !== 1 ||
        !isIdentifier(input.deliveryId) ||
        !isIdentifier(input.expectedHistoryId) ||
        !isAutomaticDeliveryStatus(input.expectedStatus) ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString() !== input.eligibleBefore) {
        throw new customErrors_1.ValidationError("Invalid delivery progression payload");
    }
    return {
        version: 1,
        deliveryId: input.deliveryId,
        expectedStatus: input.expectedStatus,
        expectedHistoryId: input.expectedHistoryId,
        eligibleBefore: date.toISOString(),
    };
}
function deliveryProgressionJobId(payload) {
    const job = parseDeliveryProgressionJob(payload);
    const identity = (0, node_crypto_1.createHash)("sha256")
        .update(JSON.stringify([job.deliveryId, job.expectedHistoryId]))
        .digest("hex");
    // No colon: usable as a future BullMQ jobId, independent of discovery time.
    return `delivery-progression-v1-${identity}`;
}
