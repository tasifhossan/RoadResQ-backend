import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { sendResponse } from '../utils/sendResponse.js';

export const globalErrorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Something went wrong';
  let errors: unknown[] | undefined = undefined;

  if (typeof err === 'object' && err !== null) {
    const errObj = err as Record<string, unknown>;

    if (typeof errObj.statusCode === 'number') {
      statusCode = errObj.statusCode;
    }

    if (typeof errObj.message === 'string' && errObj.message.trim().length > 0) {
      message = errObj.message;
    }

    if (Array.isArray(errObj.errors) && errObj.errors.length > 0) {
      errors = errObj.errors;
    }
  } else if (err instanceof Error) {
    message = err.message;
  }

  sendResponse(res, {
    statusCode,
    success: false,
    message,
    errors,
  });
};
