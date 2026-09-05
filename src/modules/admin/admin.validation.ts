import { z } from 'zod';
import { Role } from '@prisma/client';

const updateUserRoleSchema = z
  .object({
    role: z.nativeEnum(Role, {
      message: 'Role must be CUSTOMER, MECHANIC, or ADMIN',
    }),
  })
  .strict();

const getUsersQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10) || 10) : 10)),
  role: z.nativeEnum(Role).optional(),
});

const getAuditLogsQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10) || 10) : 10)),
  entityType: z.string().optional(),
  action: z.string().optional(),
});

export const AdminValidation = {
  updateUserRoleSchema,
  getUsersQuerySchema,
  getAuditLogsQuerySchema,
};
