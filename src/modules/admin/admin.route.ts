import { Router } from 'express';
import { Role } from '@prisma/client';
import { AdminController } from './admin.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';

export const adminRoutes = Router();

// Apply authentication and admin role check to all admin routes
adminRoutes.use(authenticate, authorize(Role.ADMIN));

// User Management Endpoints
adminRoutes.get('/users', AdminController.getAllUsers);
adminRoutes.patch('/users/:id/role', AdminController.updateUserRole);
adminRoutes.patch('/users/:id/deactivate', AdminController.deactivateUser);
adminRoutes.patch('/users/:id/reactivate', AdminController.reactivateUser);

// Dashboard Statistics & Audit Logs
adminRoutes.get('/dashboard-stats', AdminController.getDashboardStats);
adminRoutes.get('/audit-logs', AdminController.getAuditLogs);
