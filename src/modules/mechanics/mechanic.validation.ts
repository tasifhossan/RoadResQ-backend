import { z } from 'zod';
import { Availability } from '@prisma/client';

export const updateAvailabilitySchema = z
  .object({
    availability: z.nativeEnum(Availability),
  })
  .strict();

export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;

export const updateLocationSchema = z
  .object({
    lat: z.number(),
    lng: z.number(),
  })
  .strict();

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
