import { Request, Response, NextFunction } from 'express';
import { updateAvailabilitySchema, updateLocationSchema, getEarningsQuerySchema } from './mechanic.validation.js';
import { updateAvailability, updateLocation, getEarningsSummary } from './mechanic.service.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';

const updateAvailabilityHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const parsed = updateAvailabilitySchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const mechanicProfile = await updateAvailability(userId, parsed.data.availability);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Availability updated successfully',
      data: { mechanicProfile },
    });
  } catch (error) {
    next(error);
  }
};

const updateLocationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const parsed = updateLocationSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const mechanicProfile = await updateLocation(userId, parsed.data);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Location updated successfully',
      data: { mechanicProfile },
    });
  } catch (error) {
    next(error);
  }
};

const getEarningsSummaryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedQuery = getEarningsQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedQuery.error),
      });
      return;
    }

    const userId = req.user!.id;
    const summary = await getEarningsSummary(userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Mechanic earnings summary retrieved successfully',
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

export const MechanicController = {
  updateAvailability: updateAvailabilityHandler,
  updateLocation: updateLocationHandler,
  getEarningsSummary: getEarningsSummaryHandler,
};
