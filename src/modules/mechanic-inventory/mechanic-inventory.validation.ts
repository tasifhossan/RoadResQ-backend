import { z } from 'zod';

const addInventoryItemSchema = z
  .object({
    sparePartId: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    price: z.number().min(0, 'Price must be greater than or equal to 0'),
    stock: z.number().int('Stock must be an integer').min(0, 'Stock must be greater than or equal to 0'),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasSparePartId = Boolean(data.sparePartId);
    const hasName = Boolean(data.name);

    if (!hasSparePartId && !hasName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either sparePartId or name must be provided',
        path: ['sparePartId'],
      });
    }

    if (hasSparePartId && hasName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either sparePartId or name, not both',
        path: ['sparePartId'],
      });
    }
  });

const updateInventoryItemSchema = z
  .object({
    name: z.string().min(1, 'Name cannot be empty').optional(),
    price: z.number().min(0, 'Price must be greater than or equal to 0').optional(),
    stock: z.number().int('Stock must be an integer').min(0, 'Stock must be greater than or equal to 0').optional(),
  })
  .strict();

const restockInventoryItemSchema = z
  .object({
    quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1'),
  })
  .strict();

const getInventoryQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10) || 10) : 10)),
});

export const MechanicInventoryValidation = {
  addInventoryItemSchema,
  updateInventoryItemSchema,
  restockInventoryItemSchema,
  getInventoryQuerySchema,
};
