import { Router } from 'express';
import { Role } from '@prisma/client';
import { ServiceRequestController } from './service-request.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';

export const serviceRequestRoutes = Router();

// Apply authentication and customer role authorization for service request management
serviceRequestRoutes.use(authenticate, authorize(Role.CUSTOMER));

serviceRequestRoutes.post('/', ServiceRequestController.createServiceRequest);
serviceRequestRoutes.get('/nearby-mechanics', ServiceRequestController.getNearbyMechanics);
