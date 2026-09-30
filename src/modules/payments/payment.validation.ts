import { z } from 'zod';
import { PaymentStatus } from '@prisma/client';

const initiatePaymentSchema = z
  .object({
    invoiceId: z.string().min(1, 'Invoice ID is required'),
  })
  .strict();

const getMyPaymentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    status: z.nativeEnum(PaymentStatus).optional(),
  })
  .strict();

export type GetMyPaymentsQueryInput = z.infer<typeof getMyPaymentsQuerySchema>;

export const PaymentValidation = {
  initiatePaymentSchema,
  getMyPaymentsQuerySchema,
};
