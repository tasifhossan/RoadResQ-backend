import { Router } from 'express';
import { Role } from '@prisma/client';
import { VehicleController } from './vehicle.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';

export const vehicleRoutes = Router();

// All vehicle routes are scoped strictly to CUSTOMER role
vehicleRoutes.use(authenticate, authorize(Role.CUSTOMER));

vehicleRoutes.post('/', VehicleController.create);
vehicleRoutes.get('/me', VehicleController.getMyVehicles);
vehicleRoutes.get('/:id', VehicleController.getVehicleById);
vehicleRoutes.patch('/:id', VehicleController.updateVehicle);
vehicleRoutes.delete('/:id', VehicleController.softDeleteVehicle);
