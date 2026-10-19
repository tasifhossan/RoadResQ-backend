import { Request, Response, NextFunction } from 'express';
import { updateUserSchema, getMySummaryQuerySchema } from './user.validation.js';
import { getMe, updateMe, getMySummary } from './user.service.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';

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
        errors: formatZodError(parsed.error),
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

const getMySummaryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = getMySummaryQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const userId = req.user!.id;

    res.setHeader('Cache-Control', 'private, no-store');

    const summary = await getMySummary(userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Customer summary retrieved successfully',
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

export const UserController = {
  getMe: getMeHandler,
  updateMe: updateMeHandler,
  getMySummary: getMySummaryHandler,
};

