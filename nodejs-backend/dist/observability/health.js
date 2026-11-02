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
exports.liveness = void 0;
exports.checkDatabase = checkDatabase;
exports.readiness = readiness;
function checkDatabase(client_1) {
    return __awaiter(this, arguments, void 0, function* (client, timeoutMs = 1000) {
        yield client.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
            yield tx.$executeRaw `SET TRANSACTION READ ONLY`;
            yield tx.$queryRaw `SELECT set_config('statement_timeout', ${String(timeoutMs)}, true)`;
            yield tx.$queryRaw `SELECT 1`;
        }), { maxWait: timeoutMs, timeout: timeoutMs + 250 });
    });
}
const liveness = (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "live" });
};
exports.liveness = liveness;
function readiness(check, timeoutMs = 1500, cacheMs = 1000) {
    let pending;
    let cached;
    function inspect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (cached && cached.until > Date.now()) {
                return cached.ready;
            }
            if (pending) {
                return pending;
            }
            pending = (() => __awaiter(this, void 0, void 0, function* () {
                let timer;
                try {
                    const deadline = new Promise((_resolve, reject) => {
                        timer = setTimeout(() => reject(new Error("Readiness deadline")), timeoutMs);
                    });
                    // Keep the single-flight guard until the actual DB probe settles, even
                    // if the HTTP deadline wins. Do not accumulate queries during an outage.
                    const actual = Promise.resolve().then(check);
                    void actual
                        .then(() => undefined, () => undefined)
                        .finally(() => {
                        pending = undefined;
                    });
                    yield Promise.race([actual, deadline]);
                    cached = { ready: true, until: Date.now() + cacheMs };
                    return true;
                }
                catch (_a) {
                    cached = { ready: false, until: Date.now() + cacheMs };
                    return false;
                }
                finally {
                    clearTimeout(timer);
                }
            }))();
            return pending;
        });
    }
    return (_req, res) => __awaiter(this, void 0, void 0, function* () {
        const ready = yield inspect();
        res.setHeader("Cache-Control", "no-store");
        res
            .status(ready ? 200 : 503)
            .json({ status: ready ? "ready" : "unavailable" });
    });
}
