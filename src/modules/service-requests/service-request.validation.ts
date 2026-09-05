import { z } from 'zod';
import { RequestPriority, RequestStatus } from '@prisma/client';

export const createServiceRequestSchema = z
  .object({
    description: z.string().min(10, 'Description must be at least 10 characters'),
    lat: z.number(),
    lng: z.number(),
    vehicleId: z.string().optional(),
    priority: z.nativeEnum(RequestPriority).optional().default(RequestPriority.NORMAL),
  })
  .strict();

export const nearbyMechanicsQuerySchema = z
  .object({
    lat: z.coerce.number(),
    lng: z.coerce.number(),
    radiusKm: z.coerce.number().optional().default(10),
  })
  .strict();

export const assignMechanicSchema = z
  .object({
    mechanicId: z.string().min(1, 'Mechanic ID is required'),
  })
  .strict();

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(100).optional().default(10),
  })
  .strict();

export const updateStatusSchema = z
  .object({
    status: z.enum([
      RequestStatus.ARRIVED,
      RequestStatus.IN_PROGRESS,
      RequestStatus.COMPLETED,
      RequestStatus.CANCELLED,
    ]),
    laborCost: z.number().min(0, 'Labor cost cannot be negative').optional().default(0),
  })
  .strict();

export const addPartsUsedSchema = z
  .object({
    parts: z
      .array(
        z
          .object({
            sparePartId: z.string().min(1, 'Spare part ID is required'),
            quantity: z.number().int().min(1, 'Quantity must be at least 1'),
          })
          .strict()
      )
      .min(1, 'At least one spare part must be provided'),
  })
  .strict();

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;
export type NearbyMechanicsQueryInput = z.infer<typeof nearbyMechanicsQuerySchema>;
export type AssignMechanicInput = z.infer<typeof assignMechanicSchema>;
export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type AddPartsUsedInput = z.infer<typeof addPartsUsedSchema>;
