import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import { formatZodError } from '../utils/formatZodError.js';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().optional().default(5000),
  NODE_ENV: z.string().optional().default('development'),
  DATABASE_URL: z
    .string({ message: 'DATABASE_URL is required' })
    .min(1, 'DATABASE_URL is required'),
  FRONTEND_URL: z
    .string({ message: 'FRONTEND_URL is required' })
    .url('FRONTEND_URL must be a valid URL'),
  JWT_ACCESS_SECRET: z
    .string({ message: 'JWT_ACCESS_SECRET is required' })
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long'),
  JWT_ACCESS_EXPIRES_IN: z.string().optional().default('15m'),
  JWT_REFRESH_SECRET: z
    .string({ message: 'JWT_REFRESH_SECRET is required' })
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
  JWT_REFRESH_EXPIRES_IN: z.string().optional().default('7d'),
  SSLCOMMERZ_STORE_ID: z
    .string({ message: 'SSLCOMMERZ_STORE_ID is required' })
    .min(1, 'SSLCOMMERZ_STORE_ID is required'),
  SSLCOMMERZ_STORE_PASSWORD: z
    .string({ message: 'SSLCOMMERZ_STORE_PASSWORD is required' })
    .min(1, 'SSLCOMMERZ_STORE_PASSWORD is required'),
  SSLCOMMERZ_IS_LIVE: z
    .preprocess((val) => val === 'true', z.boolean())
    .optional()
    .default(false),
  SSLCOMMERZ_SUCCESS_URL: z
    .string()
    .optional()
    .default('https://road-res-q-backend.vercel.app/api/v1/payments/success'),
  SSLCOMMERZ_FAIL_URL: z
    .string()
    .optional()
    .default('https://road-res-q-backend.vercel.app/api/v1/payments/fail'),
  SSLCOMMERZ_CANCEL_URL: z
    .string()
    .optional()
    .default('https://road-res-q-backend.vercel.app/api/v1/payments/cancel'),
  CLOUDINARY_CLOUD_NAME: z
    .string({ message: 'CLOUDINARY_CLOUD_NAME is required' })
    .min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z
    .string({ message: 'CLOUDINARY_API_KEY is required' })
    .min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z
    .string({ message: 'CLOUDINARY_API_SECRET is required' })
    .min(1, 'CLOUDINARY_API_SECRET is required'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedErrors = formatZodError(parsedEnv.error);
  const errorLines = formattedErrors
    .map((err) => `  - ${err.field}: ${err.message}`)
    .join('\n');

  console.error(`\n❌ Environment Variable Validation Failed:\n${errorLines}\n`);
  throw new Error(`Environment variable validation failed:\n${errorLines}`);
}

const envConfig = parsedEnv.data;

export const env = {
  port: envConfig.PORT,
  nodeEnv: envConfig.NODE_ENV,
  databaseUrl: envConfig.DATABASE_URL,
  frontendUrl: envConfig.FRONTEND_URL,
  jwt: {
    accessSecret: envConfig.JWT_ACCESS_SECRET,
    accessExpiresIn: envConfig.JWT_ACCESS_EXPIRES_IN,
    refreshSecret: envConfig.JWT_REFRESH_SECRET,
    refreshExpiresIn: envConfig.JWT_REFRESH_EXPIRES_IN,
  },
  sslcommerz: {
    storeId: envConfig.SSLCOMMERZ_STORE_ID,
    storePassword: envConfig.SSLCOMMERZ_STORE_PASSWORD,
    isLive: envConfig.SSLCOMMERZ_IS_LIVE,
    successUrl: envConfig.SSLCOMMERZ_SUCCESS_URL,
    failUrl: envConfig.SSLCOMMERZ_FAIL_URL,
    cancelUrl: envConfig.SSLCOMMERZ_CANCEL_URL,
  },
  ssl: {
    storeId: envConfig.SSLCOMMERZ_STORE_ID,
    storePassword: envConfig.SSLCOMMERZ_STORE_PASSWORD,
    isLive: envConfig.SSLCOMMERZ_IS_LIVE,
    successUrl: envConfig.SSLCOMMERZ_SUCCESS_URL,
    failUrl: envConfig.SSLCOMMERZ_FAIL_URL,
    cancelUrl: envConfig.SSLCOMMERZ_CANCEL_URL,
  },
  cloudinary: {
    cloudName: envConfig.CLOUDINARY_CLOUD_NAME,
    apiKey: envConfig.CLOUDINARY_API_KEY,
    apiSecret: envConfig.CLOUDINARY_API_SECRET,
  },
};
