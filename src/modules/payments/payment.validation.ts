import { z } from 'zod';

const initiatePaymentSchema = z
  .object({
    invoiceId: z.string().min(1, 'Invoice ID is required'),
  })
  .strict();

export const PaymentValidation = {
  initiatePaymentSchema,
};
