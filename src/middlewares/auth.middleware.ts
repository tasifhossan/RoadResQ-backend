import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { sendResponse } from '../utils/sendResponse.js';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendResponse(res, {
      statusCode: 401,
      success: false,
      message: 'Unauthorized: Missing or invalid token format',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch {
    sendResponse(res, {
      statusCode: 401,
      success: false,
      message: 'Unauthorized: Invalid or expired token',
    });
    return;
  }
};
