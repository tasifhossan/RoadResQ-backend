import { z } from 'zod';

const createSparePartSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
  })
  .strict();

const updateSparePartSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
  })
  .strict();

const getSparePartsQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10) || 10) : 10)),
  search: z.string().optional(),
});

export const SparePartValidation = {
  createSparePartSchema,
  updateSparePartSchema,
  getSparePartsQuerySchema,
};
