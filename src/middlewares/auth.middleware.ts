import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
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
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendResponse(res, {
        statusCode: 401,
        success: false,
        message: 'Unauthorized: Token has expired',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      sendResponse(res, {
        statusCode: 401,
        success: false,
        message: 'Unauthorized: Invalid token',
      });
      return;
    }

    sendResponse(res, {
      statusCode: 401,
      success: false,
      message: 'Unauthorized: Authentication failed',
    });
    return;
  }
};
