import { Router } from 'express';
import { Role } from '@prisma/client';
import { SparePartController } from './spare-part.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';

export const sparePartRoutes = Router();

// Apply authentication to all spare part routes
sparePartRoutes.use(authenticate);

// Public / Any authenticated user routes
sparePartRoutes.get('/', SparePartController.getAllSpareParts);
sparePartRoutes.get('/:id', SparePartController.getSparePartById);

// Admin-only management routes
sparePartRoutes.post('/', authorize(Role.ADMIN), SparePartController.createSparePart);
sparePartRoutes.patch('/:id', authorize(Role.ADMIN), SparePartController.updateSparePart);
sparePartRoutes.delete('/:id', authorize(Role.ADMIN), SparePartController.softDeleteSparePart);

// Mechanic restocking route
sparePartRoutes.patch(
  '/:id/restock',
  authorize(Role.MECHANIC),
  SparePartController.restockSparePart
);
