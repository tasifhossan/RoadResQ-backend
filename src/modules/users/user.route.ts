import { Router } from 'express';
import { UserController } from './user.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

export const userRoutes = Router();

userRoutes.get('/me', authenticate, UserController.getMe);
userRoutes.patch('/me', authenticate, UserController.updateMe);
