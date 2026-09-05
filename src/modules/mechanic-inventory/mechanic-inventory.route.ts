import { Router } from 'express';
import { Role } from '@prisma/client';
import { MechanicInventoryController } from './mechanic-inventory.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';

export const mechanicInventoryRoutes = Router();

// Require authentication and mechanic role check for all inventory endpoints
mechanicInventoryRoutes.use(authenticate, authorize(Role.MECHANIC));

mechanicInventoryRoutes.post('/', MechanicInventoryController.addInventoryItem);
mechanicInventoryRoutes.get('/', MechanicInventoryController.getMyInventory);
mechanicInventoryRoutes.patch('/:sparePartId', MechanicInventoryController.updateInventoryItem);
mechanicInventoryRoutes.patch(
  '/:sparePartId/restock',
  MechanicInventoryController.restockInventoryItem
);
mechanicInventoryRoutes.delete('/:sparePartId', MechanicInventoryController.removeInventoryItem);
