"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevRefundProvider = exports.RefundProviderUnknownResultError = exports.RefundProviderDefinitiveError = exports.RefundProviderDeclinedError = void 0;
const crypto_1 = require("crypto");
class RefundProviderDeclinedError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "RefundProviderDeclinedError";
        if (cause !== undefined)
            this.cause = cause;
    }
}
exports.RefundProviderDeclinedError = RefundProviderDeclinedError;
class RefundProviderDefinitiveError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "RefundProviderDefinitiveError";
        if (cause !== undefined)
            this.cause = cause;
    }
}
exports.RefundProviderDefinitiveError = RefundProviderDefinitiveError;
class RefundProviderUnknownResultError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "RefundProviderUnknownResultError";
        if (cause !== undefined)
            this.cause = cause;
    }
}
exports.RefundProviderUnknownResultError = RefundProviderUnknownResultError;
class DevRefundProvider {
    constructor(outcome = "SUCCESS") {
        this.outcome = outcome;
    }
    createRefund(input) {
        return __awaiter(this, void 0, void 0, function* () { if (this.outcome === "DECLINED")
            throw new RefundProviderDeclinedError("Refund was declined by the development provider"); if (this.outcome === "DEFINITIVE_FAILURE")
            throw new RefundProviderDefinitiveError("Refund failed definitively in the development provider"); if (this.outcome === "UNKNOWN_RESULT")
            throw new RefundProviderUnknownResultError("Refund provider result is unknown"); const digest = (0, crypto_1.createHash)("sha256").update(input.refundId).digest("hex").slice(0, 24); return { provider: "DEV_SIMULATOR", providerReference: `dev_refund_${digest}` }; });
    }
}
exports.DevRefundProvider = DevRefundProvider;
