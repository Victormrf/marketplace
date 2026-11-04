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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverDeliveryProgressionJobs = discoverDeliveryProgressionJobs;
exports.processDeliveryProgressionJob = processDeliveryProgressionJob;
const deliveryRepository_1 = require("../repositories/deliveryRepository");
const deliveryService_1 = require("../services/deliveryService");
const deliveryProgression_1 = require("../types/deliveryProgression");
const BATCH_SIZE = 100;
function eligibleBefore(status, now) {
    const hours = status === "SEPARATED" ? 4 : 24;
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
}
function discoverDeliveryProgressionJobs() {
    return __asyncGenerator(this, arguments, function* discoverDeliveryProgressionJobs_1(repository = new deliveryRepository_1.DeliveryRepository(), now = () => new Date()) {
        let afterId = null;
        while (true) {
            const deliveries = yield __await(repository.findForJob(afterId, BATCH_SIZE));
            if (!deliveries.length) {
                return yield __await(void 0);
            }
            for (const delivery of deliveries) {
                afterId = delivery.id;
                const history = delivery.statusHistory[0];
                if (!(0, deliveryProgression_1.isAutomaticDeliveryStatus)(delivery.status) ||
                    !history ||
                    history.toStatus !== delivery.status) {
                    continue;
                }
                const cutoff = eligibleBefore(delivery.status, now());
                if (history.changedAt > cutoff) {
                    continue;
                }
                yield yield __await((0, deliveryProgression_1.parseDeliveryProgressionJob)({
                    version: 1,
                    deliveryId: delivery.id,
                    expectedStatus: delivery.status,
                    expectedHistoryId: history.id,
                    eligibleBefore: cutoff.toISOString(),
                }));
            }
            if (deliveries.length < BATCH_SIZE) {
                return yield __await(void 0);
            }
        }
    });
}
function processDeliveryProgressionJob(payload_1) {
    return __awaiter(this, arguments, void 0, function* (payload, service = new deliveryService_1.DeliveryService(), now = new Date()) {
        const job = (0, deliveryProgression_1.parseDeliveryProgressionJob)(payload);
        // A supplied cutoff is an expectation, never permission to shorten the wait.
        const cutoff = new Date(Math.min(new Date(job.eligibleBefore).getTime(), eligibleBefore(job.expectedStatus, now).getTime()));
        try {
            const updated = yield service.advanceForJob(job.deliveryId, job.expectedStatus, cutoff, job.expectedHistoryId);
            return {
                deliveryId: job.deliveryId,
                outcome: updated ? "applied" : "ignored",
            };
        }
        catch (error) {
            if (error instanceof deliveryRepository_1.DeliveryConcurrentChangeError) {
                return { deliveryId: job.deliveryId, outcome: "ignored" };
            }
            // Preserve technical errors and unexpected conflicts for the future worker.
            throw error;
        }
    });
}
