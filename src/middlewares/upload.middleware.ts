import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { uploadServiceRequestImages } from '../config/cloudinary.js';

export const handleServiceRequestImagesUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const upload = uploadServiceRequestImages.array('images', 5);

  upload(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        let message = err.message;
        if (err.code === 'LIMIT_FILE_SIZE') {
          message = 'File size exceeds limit of 5MB per file.';
        } else if (
          err.code === 'LIMIT_FILE_COUNT' ||
          err.code === 'LIMIT_UNEXPECTED_FILE'
        ) {
          message = 'Maximum 5 files allowed per request.';
        }
        const customError = new Error(message) as Error & { statusCode: number };
        customError.statusCode = 400;
        return next(customError);
      }

      if (typeof err === 'object' && err !== null && !('statusCode' in err)) {
        (err as Record<string, unknown>).statusCode = 400;
      }
      return next(err);
    }

    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      const customError = new Error('No images provided. Please attach at least one image file.') as Error & {
        statusCode: number;
      };
      customError.statusCode = 400;
      return next(customError);
    }

    next();
  });
};
