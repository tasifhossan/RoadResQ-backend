import { z } from 'zod';

export const createVehicleSchema = z
  .object({
    make: z.string().min(1, 'Make is required'),
    model: z.string().min(1, 'Model is required'),
    plateNumber: z.string().min(1, 'Plate number is required'),
  })
  .strict();

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = z
  .object({
    make: z.string().min(1, 'Make cannot be empty').optional(),
    model: z.string().min(1, 'Model cannot be empty').optional(),
    plateNumber: z.string().min(1, 'Plate number cannot be empty').optional(),
  })
  .strict();

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const getMyVehiclesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    search: z.string().optional(),
  })
  .strict();

export type GetMyVehiclesQueryInput = z.infer<typeof getMyVehiclesQuerySchema>;
