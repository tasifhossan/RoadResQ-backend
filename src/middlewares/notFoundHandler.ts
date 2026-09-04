import { Request, Response } from 'express';
import { sendResponse } from '../utils/sendResponse.js';

export const notFoundHandler = (req: Request, res: Response): void => {
  sendResponse(res, {
    statusCode: 404,
    success: false,
    message: `API Route Not Found: ${req.originalUrl}`,
  });
};
