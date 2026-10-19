import { Router } from 'express';
import { Role } from '@prisma/client';
import { UserController } from './user.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';

export const userRoutes = Router();

userRoutes.get(
  '/me/summary',
  authenticate,
  authorize(Role.CUSTOMER),
  UserController.getMySummary
);
userRoutes.get('/me', authenticate, UserController.getMe);
userRoutes.patch('/me', authenticate, UserController.updateMe);

