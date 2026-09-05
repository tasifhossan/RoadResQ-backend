import { Request, Response, NextFunction } from 'express';
import { registerSchema } from './auth.validation.js';
import { registerUser } from './auth.service.js';
import { sendResponse } from '../../utils/sendResponse.js';

const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body against the Zod schema
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    const user = await registerUser(parsed.data);

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: 'Registration successful',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const AuthController = { register };
