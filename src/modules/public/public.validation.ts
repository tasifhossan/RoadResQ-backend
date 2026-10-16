import { z } from 'zod';
import { Availability } from '@prisma/client';

export const MECHANIC_SKILLS = [
  'Towing',
  'Battery',
  'Tire',
  'Engine',
  'Electrical',
  'AC',
  'Brakes',
  'Lockout',
  'Fuel Delivery',
  'Transmission',
  'Engine Repair',
  'Brake Service',
  'Tire Change',
  'Battery Jumpstart',
] as const;

export type MechanicSkill = (typeof MECHANIC_SKILLS)[number];

export const getPublicMechanicsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(24).optional().default(12),
    search: z.string().trim().optional(),
    skill: z.enum(MECHANIC_SKILLS as unknown as [string, ...string[]]).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    availability: z.nativeEnum(Availability).optional(),
    minJobs: z.coerce.number().int().min(0).optional(),
    sortBy: z
      .enum(['rating', 'totalJobs', 'yearsExperience', 'newest'])
      .optional()
      .default('rating'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .strict();

export type GetPublicMechanicsQueryInput = z.infer<typeof getPublicMechanicsQuerySchema>;

export const getPublicReviewsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(12).optional().default(6),
  })
  .strict();

export type GetPublicReviewsQueryInput = z.infer<typeof getPublicReviewsQuerySchema>;
