import crypto from 'crypto';
import { Role } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { comparePassword, hashPassword } from '../../utils/hashPassword.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import { LoginInput, RegisterInput } from './auth.validation.js';

/**
 * Hashes a raw JWT refresh token using SHA-256 for secure database storage.
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Registers a new user (CUSTOMER or MECHANIC).
 */
export const registerUser = async (data: RegisterInput) => {
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
 * Generates raw refresh token for client and stores SHA-256 hash in DB.
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
  const hashedRefreshToken = hashToken(refreshToken);

  // Store SHA-256 hash of refresh token in database (expires in 7 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: hashedRefreshToken,
      userId: user.id,
      expiresAt,
    },
  });

  const userObj = { ...user };
  delete (userObj as { password?: string }).password;

  return {
    user: userObj,
    accessToken,
    refreshToken,
  };
};

/**
 * Rotates a refresh token: hashes incoming token, validates against DB hash & signature,
 * revokes the old token hash, and issues a new access token + new refresh token pair.
 */
export const refreshAccessToken = async (tokenStr: string) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(tokenStr);
  } catch {
    const err = new Error('Invalid or expired refresh token') as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  const hashedToken = hashToken(tokenStr);

  // Look up by SHA-256 token hash
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: hashedToken },
  });

  if (!storedToken) {
    const err = new Error('Invalid or revoked refresh token') as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  // Ensure stored token belongs to user in token payload
  if (storedToken.userId !== decoded.id) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    const err = new Error('Invalid or revoked refresh token') as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  // Check expiration in DB
  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    const err = new Error('Refresh token has expired') as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  // Confirm user is active and not soft-deleted
  const user = await prisma.user.findFirst({
    where: {
      id: decoded.id,
      deletedAt: null,
    },
  });

  if (!user) {
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    const err = new Error('User not found or account deactivated') as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  // REFRESH TOKEN ROTATION: Revoke old token hash and issue new pair
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  const payload = {
    id: user.id,
    role: user.role,
    email: user.email,
  };

  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);
  const newHashedRefreshToken = hashToken(newRefreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: newHashedRefreshToken,
      userId: user.id,
      expiresAt,
    },
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

/**
 * Revokes refresh token hash(es) server-side upon user logout.
 */
export const logoutUser = async (userId: string, tokenStr?: string) => {
  if (tokenStr) {
    const hashedToken = hashToken(tokenStr);
    await prisma.refreshToken.deleteMany({
      where: {
        token: hashedToken,
        userId,
      },
    });
  } else {
    // Fallback: revoke all active refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
};


