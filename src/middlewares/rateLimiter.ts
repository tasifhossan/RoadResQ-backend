import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';
import { sendResponse } from '../utils/sendResponse.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * Helper to extract authenticated user payload from Authorization header without DB calls.
 * Returns null if token is missing, malformed, or invalid.
 */
const getAuthenticatedUser = (req: Request) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      return verifyAccessToken(token);
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Rate limiter for POST /auth/login.
 * Allows 10 failed attempts per 15-minute window per key (${ip}|${email}).
 * Successful logins do not count against the limit (skipSuccessfulRequests: true).
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 failed attempts per window
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = ipKeyGenerator(req.ip || '');
    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email ? `${ip}|${email}` : ip;
  },
  handler: (_req: Request, res: Response) => {
    sendResponse(res, {
      statusCode: 429,
      success: false,
      message: 'Too many attempts, please try again later',
    });
  },
});

/**
 * Rate limiter for POST /auth/register.
 * Allows 20 requests per IP per 15-minute window.
 */
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip || ''),
  handler: (_req: Request, res: Response) => {
    sendResponse(res, {
      statusCode: 429,
      success: false,
      message: 'Too many attempts, please try again later',
    });
  },
});

/**
 * Rate limiter for POST /auth/refresh-token.
 * Allows 60 requests per IP per 15-minute window.
 */
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 60, // 60 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip || ''),
  handler: (_req: Request, res: Response) => {
    sendResponse(res, {
      statusCode: 429,
      success: false,
      message: 'Too many attempts, please try again later',
    });
  },
});

/**
 * Legacy authLimiter export for backwards compatibility.
 */
export const authLimiter = loginLimiter;

/**
 * Global API rate limiter.
 * - Authenticated requests (valid JWT): keyed by user ID, limit = 1000 per 15 mins.
 * - Unauthenticated requests: keyed by IP, limit = 100 per 15 mins.
 * - Payment callbacks (SSLCommerz) are skipped.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: (req: Request) => {
    const user = getAuthenticatedUser(req);
    return user ? 1000 : 100;
  },
  keyGenerator: (req: Request) => {
    const user = getAuthenticatedUser(req);
    if (user) {
      return `user:${user.id}`;
    }
    return `ip:${ipKeyGenerator(req.ip || '')}`;
  },
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
