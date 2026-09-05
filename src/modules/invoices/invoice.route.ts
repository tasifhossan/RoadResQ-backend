import { Router } from 'express';
import { InvoiceController } from './invoice.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

export const invoiceRoutes = Router();

// Apply authentication middleware
invoiceRoutes.use(authenticate);

invoiceRoutes.get('/:id', InvoiceController.getInvoice);
