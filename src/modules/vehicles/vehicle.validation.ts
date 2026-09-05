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
