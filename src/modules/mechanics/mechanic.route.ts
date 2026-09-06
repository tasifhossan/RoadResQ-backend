import { Router } from 'express';
import { Role } from '@prisma/client';
import { MechanicController } from './mechanic.controller.js';
import { ReviewController } from '../reviews/review.controller.js';
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

// Public-ish list of a mechanic's reviews (visible to any authenticated user)
mechanicRoutes.get(
  '/:mechanicId/reviews',
  authenticate,
  ReviewController.getMechanicReviews
);

