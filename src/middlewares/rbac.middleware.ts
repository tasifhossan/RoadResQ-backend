import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { sendResponse } from '../utils/sendResponse.js';

/**
 * Authorization middleware for Role-Based Access Control (RBAC).
 * Expects `authenticate` to have run prior to populate `req.user`.
 * Fails closed with 401 if req.user is missing, or 403 if req.user.role is not permitted.
 */
export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendResponse(res, {
        statusCode: 401,
        success: false,
        message: 'Unauthorized: Authentication required before authorization',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      sendResponse(res, {
        statusCode: 403,
        success: false,
        message: 'Forbidden: You do not have permission to access this resource',
      });
      return;
    }

    next();
  };
};
