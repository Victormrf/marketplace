"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LIMIT = exports.DEFAULT_LIMIT = exports.DEFAULT_PAGE = void 0;
exports.parsePaginationValue = parsePaginationValue;
exports.DEFAULT_PAGE = 1;
exports.DEFAULT_LIMIT = 20;
exports.MAX_LIMIT = 100;
function parsePaginationValue(value, fallback, field) {
    if (value === undefined)
        return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
        throw new Error(`Invalid ${field}`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        throw new Error(`Invalid ${field}`);
    }
    if (field === "limit" && parsed > exports.MAX_LIMIT) {
        throw new Error(`Invalid ${field}`);
    }
    return parsed;
}
