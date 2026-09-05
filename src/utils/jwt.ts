import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface TokenPayload extends JwtPayload {
  id: string;
  role: string;
  email: string;
}

/**
 * Generates a short-lived JWT access token.
 * @param payload - The data to embed in the token (id, role, email).
 * @returns Signed access token string.
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = { expiresIn: env.jwt.accessExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwt.accessSecret, options);
};

/**
 * Generates a long-lived JWT refresh token.
 * @param payload - The data to embed in the token (id, role, email).
 * @returns Signed refresh token string.
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  const options: SignOptions = { expiresIn: env.jwt.refreshExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwt.refreshSecret, options);
};

/**
 * Verifies and decodes a JWT access token.
 * @param token - The access token string to verify.
 * @returns Decoded token payload.
 * @throws JsonWebTokenError if the token is invalid or expired.
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.jwt.accessSecret) as TokenPayload;
};

/**
 * Verifies and decodes a JWT refresh token.
 * @param token - The refresh token string to verify.
 * @returns Decoded token payload.
 * @throws JsonWebTokenError if the token is invalid or expired.
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.jwt.refreshSecret) as TokenPayload;
};
