import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  ssl: {
    storeId: process.env.SSLCOMMERZ_STORE_ID || '',
    storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || '',
    isLive: process.env.SSLCOMMERZ_IS_LIVE === 'true',
    successUrl:
      process.env.SSLCOMMERZ_SUCCESS_URL ||
      'http://localhost:5000/api/v1/payments/success',
    failUrl:
      process.env.SSLCOMMERZ_FAIL_URL ||
      'http://localhost:5000/api/v1/payments/fail',
    cancelUrl:
      process.env.SSLCOMMERZ_CANCEL_URL ||
      'http://localhost:5000/api/v1/payments/cancel',
  },
};
