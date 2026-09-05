import { Role } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { comparePassword, hashPassword } from '../../utils/hashPassword.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt.js';
import { LoginInput, RegisterInput } from './auth.validation.js';

/**
 * Registers a new user (CUSTOMER or MECHANIC).
 *
 * Duplicate-email policy:
 *   We reject registration if a record with the same email exists — even if it
 *   has been soft-deleted (deletedAt IS NOT NULL).  Rationale: soft-deleted
 *   accounts may be restored by an admin later; silently letting someone else
 *   claim that email would make restoration impossible and could expose the
 *   original owner's account to hijacking. The appropriate path for a user who
 *   deleted their account and wants to re-register is to contact support.
 */
export const registerUser = async (data: RegisterInput) => {
  // Check if email already exists (including soft-deleted records)
  const existing = await prisma.user.findFirst({
    where: { email: data.email },
  });

  if (existing) {
    const err = new Error('An account with this email already exists') as Error & {
      statusCode: number;
    };
    err.statusCode = 409;
    throw err;
  }

  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role as Role,
      phone: data.phone,
      // If registering as MECHANIC, bootstrap an empty MechanicProfile immediately
      ...(data.role === 'MECHANIC' && {
        mechanicProfile: {
          create: {
            skills: [],
            availability: 'OFFLINE',
            rating: 0,
            totalJobs: 0,
          },
        },
      }),
    },
    // Explicitly select everything except the password hash — never returned
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      mechanicProfile: true,
    },
  });

  return user;
};

/**
 * Authenticates a user with email and password.
 * Excludes soft-deleted users (deletedAt != null).
 * Returns generic "Invalid credentials" error for both missing user and wrong password.
 */
export const loginUser = async (data: LoginInput) => {
  const user = await prisma.user.findFirst({
    where: {
      email: data.email,
      deletedAt: null,
    },
  });

  const invalidCredsError = () => {
    const err = new Error('Invalid credentials') as Error & { statusCode: number };
    err.statusCode = 401;
    return err;
  };

  if (!user) {
    throw invalidCredsError();
  }

  const isPasswordValid = await comparePassword(data.password, user.password);
  if (!isPasswordValid) {
    throw invalidCredsError();
  }

  const payload = {
    id: user.id,
    role: user.role,
    email: user.email,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Return user stripping password
  const userObj = { ...user };
  delete (userObj as { password?: string }).password;

  return {
    user: userObj,
    accessToken,
    refreshToken,
  };
};

