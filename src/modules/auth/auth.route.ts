import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import {
  registerLimiter,
  loginLimiter,
  refreshTokenLimiter,
} from '../../middlewares/rateLimiter.js';

export const authRoutes = Router();

authRoutes.post('/register', registerLimiter, AuthController.register);
authRoutes.post('/login', loginLimiter, AuthController.login);
authRoutes.post('/refresh-token', refreshTokenLimiter, AuthController.refreshToken);
authRoutes.post('/logout', authenticate, AuthController.logout);
