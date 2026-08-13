import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  errors?: any;
}

export const errorMiddleware = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const originalMessage = err.message || 'Internal Server Error';
  
  // Mask the message for the client on 500 errors
  const clientMessage = statusCode === 500 ? 'Something went wrong' : originalMessage;

  console.error(`[Error] ${req.method} ${req.path} >> ${statusCode}: ${originalMessage}`);
  
  if (err.errors) {
    console.error('Validation Errors:', err.errors);
  }

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    errors: err.errors || undefined,
  });
};
