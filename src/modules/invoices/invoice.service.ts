import { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';

/**
 * Generates an invoice for a completed service request.
 * Sums partsCost = sum(priceAtUse * quantity) across all ServiceRequestPart rows.
 * Calculates totalAmount = laborCost + partsCost.
 * Prevents double invoicing gracefully with a 409 Conflict error.
 */
export const generateInvoice = async (
  serviceRequestId: string,
  laborCost: number,
  transactionClient?: Prisma.TransactionClient
) => {
  const db = transactionClient || prisma;

  // Guard against double-invoicing: check if invoice already exists
  const existingInvoice = await db.invoice.findUnique({
    where: { serviceRequestId },
  });

  if (existingInvoice) {
    const err = new Error('Invoice already generated for this service request') as Error & {
      statusCode: number;
    };
    err.statusCode = 409;
    throw err;
  }

  // Calculate partsCost from all ServiceRequestPart rows logged for this request
  const partsUsed = await db.serviceRequestPart.findMany({
    where: { serviceRequestId },
  });

  const partsCostNumber = partsUsed.reduce(
    (sum, part) => sum + Number(part.priceAtUse) * part.quantity,
    0
  );

  const totalAmountNumber = laborCost + partsCostNumber;

  const invoice = await db.invoice.create({
    data: {
      serviceRequestId,
      laborCost: new Prisma.Decimal(laborCost),
      partsCost: new Prisma.Decimal(partsCostNumber),
      totalAmount: new Prisma.Decimal(totalAmountNumber),
      status: InvoiceStatus.PENDING,
    },
  });

  return invoice;
};

/**
 * Fetches an invoice by ID with strict ownership authorization.
 * Accessible only to:
 * 1. The customer who owns the underlying service request
 * 2. The mechanic assigned to it
 * 3. An ADMIN
 * Throws 404 if not found or unauthorized (existence-leak protection).
 */
export const getInvoice = async (
  invoiceId: string,
  requestingUserId: string,
  requestingRole: string
) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      serviceRequest: {
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
          mechanic: {
            select: { id: true, name: true, email: true, phone: true },
          },
          vehicle: true,
          partsUsed: {
            include: {
              sparePart: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    const err = new Error('Invoice not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const isCustomerOwner = invoice.serviceRequest.customerId === requestingUserId;
  const isAssignedMechanic = invoice.serviceRequest.mechanicId === requestingUserId;
  const isAdmin = requestingRole === 'ADMIN';

  if (!isCustomerOwner && !isAssignedMechanic && !isAdmin) {
    const err = new Error('Invoice not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return invoice;
};

export const InvoiceService = {
  generateInvoice,
  getInvoice,
};
