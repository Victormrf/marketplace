"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContext = void 0;
exports.getRequestId = getRequestId;
const node_async_hooks_1 = require("node:async_hooks");
exports.requestContext = new node_async_hooks_1.AsyncLocalStorage();
function getRequestId() {
    var _a;
    return (_a = exports.requestContext.getStore()) === null || _a === void 0 ? void 0 : _a.requestId;
}
