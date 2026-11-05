import { AsyncLocalStorage } from "node:async_hooks";

type RequestContext = { requestId: string };

export const requestContext = new AsyncLocalStorage<RequestContext>();
