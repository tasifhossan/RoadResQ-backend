import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { sendResponse } from '../utils/sendResponse.js';

/**
 * Stricter rate limiter for sensitive authentication endpoints.
 * Allows 10 requests per IP per 15-minute window.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    sendResponse(res, {
      statusCode: 429,
      success: false,
      message: 'Too many attempts, please try again later',
    });
  },
});

/**
 * Looser general rate limiter for global API endpoints.
 * Allows 100 requests per IP per 15-minute window.
 * Excludes SSLCommerz payment callback routes.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    const path = req.originalUrl || req.url || '';
    return (
      path.includes('/payments/success') ||
      path.includes('/payments/fail') ||
      path.includes('/payments/cancel')
    );
  },
  handler: (_req: Request, res: Response) => {
    sendResponse(res, {
      statusCode: 429,
      success: false,
      message: 'Too many attempts, please try again later',
    });
  },
});
