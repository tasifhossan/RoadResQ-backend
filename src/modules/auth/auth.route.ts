import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

export const authRoutes = Router();

authRoutes.post('/register', AuthController.register);
authRoutes.post('/login', AuthController.login);
authRoutes.post('/refresh-token', AuthController.refreshToken);
authRoutes.post('/logout', authenticate, AuthController.logout);



