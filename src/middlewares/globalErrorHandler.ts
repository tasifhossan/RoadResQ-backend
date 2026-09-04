import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { sendResponse } from '../utils/sendResponse.js';

export const globalErrorHandler: ErrorRequestHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong';
  const errors = err.errors || [];

  sendResponse(res, {
    statusCode,
    success: false,
    message,
    errors: errors.length > 0 ? errors : undefined,
  });
};
