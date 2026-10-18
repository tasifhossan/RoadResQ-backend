import crypto from 'crypto';
import { Role } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { comparePassword, hashPassword } from '../../utils/hashPassword.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import { LoginInput, RegisterInput } from './auth.validation.js';

export const oauth2Client = new OAuth2Client();

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

/**
 * Authenticates or registers a user via Google ID token.
 * Validates token with Google OAuth2Client, enforces role/deactivation checks,
 * creates customer if user does not exist, and returns JWT access + refresh tokens.
 */
export const signInWithGoogle = async (idToken: string) => {
  if (!env.googleClientId || env.googleClientId.trim().length === 0) {
    const err = new Error('Google sign-in is not configured') as Error & {
      statusCode: number;
    };
    err.statusCode = 503;
    throw err;
  }

  let ticket;
  try {
    ticket = await oauth2Client.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
  } catch (error: any) {
    const err = new Error(
      error?.message || 'Invalid or expired Google token'
    ) as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }

  const payload = ticket?.getPayload();
  if (!payload || !payload.email || payload.email_verified !== true) {
    const err = new Error('Google account email is not verified') as Error & {
      statusCode: number;
    };
    err.statusCode = 401;
    throw err;
  }

  const email = payload.email.trim().toLowerCase();

  let user = await prisma.user.findFirst({
    where: { email },
  });

  if (user) {
    if (user.deletedAt) {
      const err = new Error('Account deactivated') as Error & { statusCode: number };
      err.statusCode = 403;
      throw err;
    }

    if (user.role === Role.ADMIN) {
      const err = new Error('Admin accounts cannot use Google sign-in') as Error & {
        statusCode: number;
      };
      err.statusCode = 403;
      throw err;
    }
  } else {
    const fallbackLocalPart = email.split('@')[0] || 'User';
    const rawName =
      payload.name && payload.name.trim().length > 0 ? payload.name.trim() : fallbackLocalPart;
    const name = rawName.slice(0, 100);

    const randomPassword = crypto.randomBytes(24).toString('hex');
    const hashedPassword = await hashPassword(randomPassword);

    user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.CUSTOMER,
        phone: null,
      },
    });
  }

  const tokenPayload = {
    id: user.id,
    role: user.role,
    email: user.email,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
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


