import { z } from 'zod';

const createSparePartSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    price: z.number().min(0, 'Price must be greater than or equal to 0'),
    stock: z.number().int('Stock must be an integer').min(0, 'Stock must be greater than or equal to 0'),
  })
  .strict();

const updateSparePartSchema = z
  .object({
    name: z.string().min(1, 'Name cannot be empty').optional(),
    price: z.number().min(0, 'Price must be greater than or equal to 0').optional(),
    stock: z.number().int('Stock must be an integer').min(0, 'Stock must be greater than or equal to 0').optional(),
  })
  .strict();

const restockSparePartSchema = z
  .object({
    quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1'),
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
  restockSparePartSchema,
  getSparePartsQuerySchema,
};
