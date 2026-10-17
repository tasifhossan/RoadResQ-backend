import { Request, Response, NextFunction } from 'express';
import {
  getPublicMechanicsQuerySchema,
  getPublicReviewsQuerySchema,
} from './public.validation.js';
import { PublicService } from './public.service.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';

const PUBLIC_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

const getMechanics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedQuery = getPublicMechanicsQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedQuery.error),
      });
      return;
    }

    const result = await PublicService.getPublicMechanics(parsedQuery.data);

    res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Public mechanics retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getMechanicById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await PublicService.getPublicMechanicById(id);

    res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Public mechanic profile retrieved successfully',
      data: {
        ...result,
        mechanic: result,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getStats = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await PublicService.getPublicStats();

    res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Public platform statistics retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedQuery = getPublicReviewsQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedQuery.error),
      });
      return;
    }

    const reviews = await PublicService.getPublicReviews(parsedQuery.data);

    res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Public reviews retrieved successfully',
      data: {
        reviews,
        items: reviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const PublicController = {
  getMechanics,
  getMechanicById,
  getStats,
  getReviews,
};
