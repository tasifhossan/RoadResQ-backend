import { Request, Response, NextFunction } from 'express';
import { updateUserSchema } from './user.validation.js';
import { getMe, updateMe } from './user.service.js';
import { sendResponse } from '../../utils/sendResponse.js';

const getMeHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // req.user is populated by authenticate middleware
    const userId = req.user!.id;
    const user = await getMe(userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'User profile retrieved successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const updateMeHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const parsed = updateUserSchema.safeParse(req.body);

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

    const user = await updateMe(userId, parsed.data);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'User profile updated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const UserController = {
  getMe: getMeHandler,
  updateMe: updateMeHandler,
};
