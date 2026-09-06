import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authLimiter } from '../../middlewares/rateLimiter.js';

export const authRoutes = Router();

authRoutes.post('/register', authLimiter, AuthController.register);
authRoutes.post('/login', authLimiter, AuthController.login);
authRoutes.post('/refresh-token', authLimiter, AuthController.refreshToken);
authRoutes.post('/logout', authenticate, AuthController.logout);




