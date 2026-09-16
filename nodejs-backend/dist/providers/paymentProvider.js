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
exports.DevPaymentProvider = exports.PaymentProviderUnknownResultError = exports.PaymentProviderDefinitiveError = void 0;
const crypto_1 = require("crypto");
class PaymentProviderDefinitiveError extends Error {
    constructor(message, failureCode = "PROVIDER_DECLINED", cause) {
        super(message);
        this.name = "PaymentProviderDefinitiveError";
        this.failureCode = failureCode;
        if (cause !== undefined)
            this.cause = cause;
    }
}
exports.PaymentProviderDefinitiveError = PaymentProviderDefinitiveError;
class PaymentProviderUnknownResultError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = "PaymentProviderUnknownResultError";
        if (cause !== undefined)
            this.cause = cause;
    }
}
exports.PaymentProviderUnknownResultError = PaymentProviderUnknownResultError;
class DevPaymentProvider {
    constructor(outcome = "SUCCESS") {
        this.outcome = outcome;
    }
    createAttempt(input) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.outcome === "DEFINITIVE_FAILURE")
                throw new PaymentProviderDefinitiveError("Payment was declined by the development provider");
            if (this.outcome === "UNKNOWN_RESULT")
                throw new PaymentProviderUnknownResultError("Payment provider result is unknown");
            const digest = (0, crypto_1.createHash)("sha256").update(input.paymentAttemptId).digest("hex").slice(0, 24);
            return { provider: "DEV_SIMULATOR", providerReference: `dev_${digest}` };
        });
    }
}
exports.DevPaymentProvider = DevPaymentProvider;
