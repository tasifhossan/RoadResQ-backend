import { z } from 'zod';

const createReviewSchema = z
  .object({
    rating: z
      .number({ message: 'Rating is required' })
      .int('Rating must be an integer')
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating cannot exceed 5'),
    comment: z
      .string()
      .max(500, 'Comment cannot exceed 500 characters')
      .optional(),
  })
  .strict();

const getMechanicReviewsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 10) : 10)),
});

export const ReviewValidation = {
  createReviewSchema,
  getMechanicReviewsQuerySchema,
};
