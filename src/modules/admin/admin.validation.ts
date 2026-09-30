import { z } from 'zod';
import { Role } from '@prisma/client';
import { booleanQuerySchema, dateQuerySchema } from '../../utils/pagination.js';

const updateUserRoleSchema = z
  .object({
    role: z.nativeEnum(Role, {
      message: 'Role must be CUSTOMER, MECHANIC, or ADMIN',
    }),
  })
  .strict();

const getUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    search: z.string().optional(),
    isActive: booleanQuerySchema,
    role: z.nativeEnum(Role).optional(),
    sortBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .strict();

export type GetUsersQueryInput = z.infer<typeof getUsersQuerySchema>;

const getAuditLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    entityType: z.string().optional(),
    action: z.string().optional(),
    from: dateQuerySchema,
    to: dateQuerySchema,
  })
  .strict();

export type GetAuditLogsQueryInput = z.infer<typeof getAuditLogsQuerySchema>;

export const AdminValidation = {
  updateUserRoleSchema,
  getUsersQuerySchema,
  getAuditLogsQuerySchema,
};
