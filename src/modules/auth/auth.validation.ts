import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  // CUSTOMER and MECHANIC can self-register; ADMIN is excluded from the enum
  // entirely — not even accepted as a valid value — preventing self-registration
  // without any runtime role-check layer.
  role: z.enum(['CUSTOMER', 'MECHANIC'], {
    error: 'Role must be CUSTOMER or MECHANIC',
  }),
  phone: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
