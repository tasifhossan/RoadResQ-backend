import { z } from 'zod';

/**
 * Shared pagination query schema.
 * - page: integer >= 1, default 1
 * - limit: integer 1..50, default 10
 * All query values arrive as strings, so we use z.coerce.
 */
export const createPaginationQuerySchema = (defaultLimit = 10) =>
  z
    .object({
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(50).optional().default(defaultLimit),
    })
    .strict();

export const paginationQuerySchema = createPaginationQuerySchema(10);

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * Builds the standardised paginated list response shape.
 */
export const buildPaginatedResponse = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> => ({
  items,
  meta: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
});
