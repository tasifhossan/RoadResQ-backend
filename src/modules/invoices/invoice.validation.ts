import { z } from 'zod';

export const getInvoiceParamsSchema = z
  .object({
    id: z.string().min(1, 'Invoice ID is required'),
  })
  .strict();

export type GetInvoiceParamsInput = z.infer<typeof getInvoiceParamsSchema>;
