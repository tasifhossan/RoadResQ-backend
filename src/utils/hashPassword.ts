import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hashes a plain-text password using bcrypt.
 * @param plain - The plain-text password to hash.
 * @returns The hashed password string.
 */
export const hashPassword = async (plain: string): Promise<string> => {
  return bcrypt.hash(plain, SALT_ROUNDS);
};

/**
 * Compares a plain-text password against a bcrypt hash.
 * @param plain - The plain-text password to compare.
 * @param hash  - The stored bcrypt hash.
 * @returns True if the password matches the hash, false otherwise.
 */
export const comparePassword = async (plain: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(plain, hash);
};
