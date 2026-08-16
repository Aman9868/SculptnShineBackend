import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';

export type RequestContext = {
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
};

const requestContext = new AsyncLocalStorage<RequestContext>();

export const requestContextMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || undefined;

  requestContext.run(
    {
      ipAddress,
      userAgent,
    },
    next
  );
};

export const setRequestUser = (userId?: string, userEmail?: string) => {
  const store = requestContext.getStore();
  if (store) {
    if (userId) store.userId = userId;
    if (userEmail) store.userEmail = userEmail;
  }
};

export const setRequestUserId = (userId: string) => {
  const store = requestContext.getStore();
  if (store) {
    store.userId = userId;
  }
};

export const getRequestContext = (): RequestContext => {
  return requestContext.getStore() || {};
};

export const getRequestUserId = () => requestContext.getStore()?.userId;
export const getRequestUserEmail = () => requestContext.getStore()?.userEmail;
export const getRequestIp = () => requestContext.getStore()?.ipAddress;
export const getRequestUserAgent = () => requestContext.getStore()?.userAgent;
