import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import { Request } from 'express';
import { env } from './env.js';

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (_req: Request, file: Express.Multer.File) => {
    const filenameWithoutExt = file.originalname
      .split('.')
      .slice(0, -1)
      .join('.')
      .replace(/[^a-zA-Z0-9]/g, '_');
    return {
      folder: 'roadresq/service-requests',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      public_id: `${Date.now()}-${filenameWithoutExt}`,
    };
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(
      'Invalid file type. Only JPG, JPEG, PNG, and WEBP images are allowed.'
    ) as Error & { statusCode: number };
    error.statusCode = 400;
    cb(error);
  }
};

export const uploadServiceRequestImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export { cloudinary };
