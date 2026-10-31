import { AsyncLocalStorage } from "node:async_hooks";

export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
