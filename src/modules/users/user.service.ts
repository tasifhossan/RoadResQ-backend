import { prisma } from '../../config/db.js';
import { UpdateUserInput } from './user.validation.js';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  mechanicProfile: true,
};

/**
 * Retrieves profile information for the authenticated user.
 * Excludes password and soft-deleted users (deletedAt != null).
 * Includes mechanicProfile relation (returns profile if MECHANIC, null if CUSTOMER).
 */
export const getMe = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    select: userSelect,
  });

  if (!user) {
    const err = new Error('User not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return user;
};

/**
 * Updates profile information (name, phone) for the authenticated user.
 * Ignores restricted fields (email, role).
 */
export const updateMe = async (userId: string, data: UpdateUserInput) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
  });

  if (!existingUser) {
    const err = new Error('User not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
    },
    select: userSelect,
  });

  return updatedUser;
};

export const UserService = { getMe, updateMe };
