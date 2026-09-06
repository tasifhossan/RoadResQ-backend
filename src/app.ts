import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { sendResponse } from './utils/sendResponse.js';
import { globalErrorHandler } from './middlewares/globalErrorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';

import { authRoutes } from './modules/auth/auth.route.js';
import { userRoutes } from './modules/users/user.route.js';
import { vehicleRoutes } from './modules/vehicles/vehicle.route.js';
import { mechanicRoutes } from './modules/mechanics/mechanic.route.js';
import { mechanicInventoryRoutes } from './modules/mechanic-inventory/mechanic-inventory.route.js';
import { serviceRequestRoutes } from './modules/service-requests/service-request.route.js';
import { sparePartRoutes } from './modules/spare-parts/spare-part.route.js';
import { invoiceRoutes } from './modules/invoices/invoice.route.js';
import { paymentRoutes } from './modules/payments/payment.route.js';
import { adminRoutes } from './modules/admin/admin.route.js';
import { generalLimiter } from './middlewares/rateLimiter.js';

const app: Application = express();

// Trust proxy for Vercel edge infrastructure (resolves true client IP for rate limiting)
app.set('trust proxy', 1);

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// Welcome route
app.get('/', (_req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Welcome to RoadResQ REST API',
    data: {
      healthCheck: '/api/v1/health',
    },
  });
});

// Health check endpoint
app.get('/api/v1/health', (_req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'RoadResQ API is healthy and operational',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// Application Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/mechanics/me/inventory', mechanicInventoryRoutes);
app.use('/api/v1/mechanics', mechanicRoutes);
app.use('/api/v1/service-requests', serviceRequestRoutes);
app.use('/api/v1/spare-parts', sparePartRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);

// Error Handling
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
