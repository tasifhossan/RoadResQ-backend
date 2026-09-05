import { z } from 'zod';
import { RequestPriority } from '@prisma/client';

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

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;
export type NearbyMechanicsQueryInput = z.infer<typeof nearbyMechanicsQuerySchema>;
export type AssignMechanicInput = z.infer<typeof assignMechanicSchema>;
export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;
