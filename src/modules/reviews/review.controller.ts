import { Request, Response, NextFunction } from 'express';
import { ReviewValidation } from './review.validation.js';
import { ReviewService } from './review.service.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';

const createReview = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const serviceRequestId = req.params.id;
    const parsedBody = ReviewValidation.createReviewSchema.safeParse(req.body);

    if (!parsedBody.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedBody.error),
      });
      return;
    }

    const review = await ReviewService.createReview(
      serviceRequestId,
      customerId,
      parsedBody.data
    );

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: 'Review submitted successfully',
      data: { review },
    });
  } catch (error) {
    next(error);
  }
};

const getMechanicReviews = async (
  req: Request<{ mechanicId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const mechanicId = req.params.mechanicId;
    const parsedQuery = ReviewValidation.getMechanicReviewsQuerySchema.safeParse(
      req.query
    );

    const page = parsedQuery.success ? parsedQuery.data.page : 1;
    const limit = parsedQuery.success ? parsedQuery.data.limit : 10;

    const result = await ReviewService.getMechanicReviews(mechanicId, page, limit);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Mechanic reviews retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getReviewByServiceRequest = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const serviceRequestId = req.params.id;
    const requestingUserId = req.user!.id;
    const requestingRole = req.user!.role;

    const review = await ReviewService.getReviewByServiceRequest(
      serviceRequestId,
      requestingUserId,
      requestingRole
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Review retrieved successfully',
      data: { review },
    });
  } catch (error) {
    next(error);
  }
};

export const ReviewController = {
  createReview,
  getMechanicReviews,
  getReviewByServiceRequest,
};
