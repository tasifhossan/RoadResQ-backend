import { Request, Response, NextFunction } from 'express';
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  googleAuthSchema,
} from './auth.validation.js';
import {
  loginUser,
  registerUser,
  refreshAccessToken,
  logoutUser,
  signInWithGoogle,
} from './auth.service.js';
import { env } from '../../config/env.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';

const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body against the Zod schema
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
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

const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const result = await loginUser(parsed.data);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const googleSignIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!env.googleClientId || env.googleClientId.trim().length === 0) {
      sendResponse(res, {
        statusCode: 503,
        success: false,
        message: 'Google sign-in is not configured',
      });
      return;
    }

    const parsed = googleAuthSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const result = await signInWithGoogle(parsed.data.idToken);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const refreshTokenHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = refreshTokenSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const result = await refreshAccessToken(parsed.data.refreshToken);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Access token refreshed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const logoutHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const refreshToken =
      typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;

    await logoutUser(userId, refreshToken);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
};

export const AuthController = {
  register,
  login,
  googleSignIn,
  refreshToken: refreshTokenHandler,
  logout: logoutHandler,
};

