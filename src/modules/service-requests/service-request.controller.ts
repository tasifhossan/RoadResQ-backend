import { Request, Response, NextFunction } from 'express';
import {
  createServiceRequestSchema,
  nearbyMechanicsQuerySchema,
} from './service-request.validation.js';
import {
  createServiceRequest as createServiceRequestService,
  findNearbyMechanics as findNearbyMechanicsService,
} from './service-request.service.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';

const createServiceRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const parsed = createServiceRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const serviceRequest = await createServiceRequestService(customerId, parsed.data);

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: 'Service request created successfully',
      data: { serviceRequest },
    });
  } catch (error) {
    next(error);
  }
};

const getNearbyMechanics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = nearbyMechanicsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const mechanics = await findNearbyMechanicsService(
      parsed.data.lat,
      parsed.data.lng,
      parsed.data.radiusKm
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Nearby mechanics retrieved successfully',
      data: { mechanics },
    });
  } catch (error) {
    next(error);
  }
};

export const ServiceRequestController = {
  createServiceRequest,
  getNearbyMechanics,
};
