import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';

type RequestContext = {
  userId?: string;
};

const requestContext = new AsyncLocalStorage<RequestContext>();

export const requestContextMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  requestContext.run({}, next);
};

export const setRequestUserId = (userId: string) => {
  const store = requestContext.getStore();
  if (store) {
    store.userId = userId;
  }
};

export const getRequestUserId = () => requestContext.getStore()?.userId;
