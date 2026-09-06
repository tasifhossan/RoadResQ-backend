import { Router } from 'express';
import { Role } from '@prisma/client';
import { ReviewController } from './review.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';

export const reviewRoutes = Router();

reviewRoutes.use(authenticate);

reviewRoutes.get('/mechanics/:mechanicId', ReviewController.getMechanicReviews);
reviewRoutes.get('/service-requests/:id', ReviewController.getReviewByServiceRequest);
reviewRoutes.post(
  '/service-requests/:id',
  authorize(Role.CUSTOMER),
  ReviewController.createReview
);
