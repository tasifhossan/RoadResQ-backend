import { Router } from 'express';
import { Role } from '@prisma/client';
import { MechanicController } from './mechanic.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';

export const mechanicRoutes = Router();

// Mechanic profile update endpoints scoped strictly to MECHANIC role
mechanicRoutes.patch(
  '/me/availability',
  authenticate,
  authorize(Role.MECHANIC),
  MechanicController.updateAvailability
);

mechanicRoutes.patch(
  '/me/location',
  authenticate,
  authorize(Role.MECHANIC),
  MechanicController.updateLocation
);
