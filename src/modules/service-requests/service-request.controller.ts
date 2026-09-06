import { Request, Response, NextFunction } from 'express';
import {
  createServiceRequestSchema,
  nearbyMechanicsQuerySchema,
  assignMechanicSchema,
  paginationQuerySchema,
  updateStatusSchema,
  addPartsUsedSchema,
} from './service-request.validation.js';
import {
  createServiceRequest as createServiceRequestService,
  findNearbyMechanics as findNearbyMechanicsService,
  assignMechanic as assignMechanicService,
  acceptAssignment as acceptAssignmentService,
  updateStatus as updateStatusService,
  addPartsUsed as addPartsUsedService,
  getMyServiceRequests as getMyServiceRequestsService,
  getAssignedServiceRequests as getAssignedServiceRequestsService,
  addServiceRequestImages as addServiceRequestImagesService,
  getServiceRequestImages as getServiceRequestImagesService,
} from './service-request.service.js';

// Controller definitions continue...

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

const assignMechanic = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const serviceRequestId = req.params.id;
    const parsed = assignMechanicSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const serviceRequest = await assignMechanicService(
      serviceRequestId,
      customerId,
      parsed.data.mechanicId
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Mechanic assigned successfully',
      data: { serviceRequest },
    });
  } catch (error) {
    next(error);
  }
};

const acceptAssignment = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const mechanicUserId = req.user!.id;
    const serviceRequestId = req.params.id;

    const serviceRequest = await acceptAssignmentService(serviceRequestId, mechanicUserId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Assignment accepted successfully',
      data: { serviceRequest },
    });
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const mechanicUserId = req.user!.id;
    const serviceRequestId = req.params.id;
    const parsed = updateStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const result = await updateStatusService(
      serviceRequestId,
      mechanicUserId,
      parsed.data.status,
      parsed.data.laborCost
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: `Service request status updated to ${parsed.data.status}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const addPartsUsed = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const mechanicUserId = req.user!.id;
    const serviceRequestId = req.params.id;
    const parsed = addPartsUsedSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const partsUsed = await addPartsUsedService(
      serviceRequestId,
      mechanicUserId,
      parsed.data.parts
    );

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: 'Spare parts logged successfully',
      data: { partsUsed },
    });
  } catch (error) {
    next(error);
  }
};

const getMyServiceRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const parsed = paginationQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const result = await getMyServiceRequestsService(
      customerId,
      parsed.data.page,
      parsed.data.limit
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Customer service requests retrieved successfully',
      data: {
        meta: result.meta,
        serviceRequests: result.serviceRequests,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAssignedServiceRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const mechanicUserId = req.user!.id;
    const parsed = paginationQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const result = await getAssignedServiceRequestsService(
      mechanicUserId,
      parsed.data.page,
      parsed.data.limit
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Assigned service requests retrieved successfully',
      data: {
        meta: result.meta,
        serviceRequests: result.serviceRequests,
      },
    });
  } catch (error) {
    next(error);
  }
};

const addImages = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const customerId = req.user!.id;
    const serviceRequestId = req.params.id;
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];

    const images = await addServiceRequestImagesService(
      serviceRequestId,
      customerId,
      uploadedFiles
    );

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: 'Damage photos uploaded successfully',
      data: { images },
    });
  } catch (error) {
    next(error);
  }
};

const getImages = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requestingUserId = req.user!.id;
    const requestingRole = req.user!.role;
    const serviceRequestId = req.params.id;

    const images = await getServiceRequestImagesService(
      serviceRequestId,
      requestingUserId,
      requestingRole
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Service request images retrieved successfully',
      data: { images },
    });
  } catch (error) {
    next(error);
  }
};

export const ServiceRequestController = {
  createServiceRequest,
  getNearbyMechanics,
  assignMechanic,
  acceptAssignment,
  updateStatus,
  addPartsUsed,
  getMyServiceRequests,
  getAssignedServiceRequests,
  addImages,
  getImages,
};

