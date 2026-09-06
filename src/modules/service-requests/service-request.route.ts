import { Router } from 'express';
import { Role } from '@prisma/client';
import { ServiceRequestController } from './service-request.controller.js';
import { ReviewController } from '../reviews/review.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';

export const serviceRequestRoutes = Router();

// Require authentication for all service request routes
serviceRequestRoutes.use(authenticate);

// Customer routes
serviceRequestRoutes.post(
  '/',
  authorize(Role.CUSTOMER),
  ServiceRequestController.createServiceRequest
);
serviceRequestRoutes.get(
  '/nearby-mechanics',
  authorize(Role.CUSTOMER),
  ServiceRequestController.getNearbyMechanics
);
serviceRequestRoutes.get(
  '/my',
  authorize(Role.CUSTOMER),
  ServiceRequestController.getMyServiceRequests
);
serviceRequestRoutes.post(
  '/:id/assign',
  authorize(Role.CUSTOMER),
  ServiceRequestController.assignMechanic
);

// Review routes for service requests
serviceRequestRoutes.post(
  '/:id/review',
  authorize(Role.CUSTOMER),
  ReviewController.createReview
);
serviceRequestRoutes.get(
  '/:id/review',
  ReviewController.getReviewByServiceRequest
);

// Mechanic routes
serviceRequestRoutes.get(
  '/assigned',
  authorize(Role.MECHANIC),
  ServiceRequestController.getAssignedServiceRequests
);
serviceRequestRoutes.post(
  '/:id/accept',
  authorize(Role.MECHANIC),
  ServiceRequestController.acceptAssignment
);
serviceRequestRoutes.patch(
  '/:id/status',
  authorize(Role.MECHANIC),
  ServiceRequestController.updateStatus
);
serviceRequestRoutes.post(
  '/:id/parts',
  authorize(Role.MECHANIC),
  ServiceRequestController.addPartsUsed
);

