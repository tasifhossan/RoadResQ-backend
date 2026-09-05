import { Router } from 'express';
import { Role } from '@prisma/client';
import { PaymentController } from './payment.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/rbac.middleware.js';

export const paymentRoutes = Router();

// Public callback endpoints (SSLCommerz server-to-server or browser callbacks)
paymentRoutes.post('/success', PaymentController.handleSuccess);
paymentRoutes.post('/fail', PaymentController.handleFail);
paymentRoutes.post('/cancel', PaymentController.handleCancel);

// Authenticated customer route to initiate payment
paymentRoutes.post(
  '/initiate',
  authenticate,
  authorize(Role.CUSTOMER),
  PaymentController.initiatePayment
);

// Authenticated endpoint to get payment status (ownership checked)
paymentRoutes.get(
  '/:id',
  authenticate,
  PaymentController.getPaymentStatus
);
