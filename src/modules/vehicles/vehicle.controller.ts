import { Request, Response, NextFunction } from 'express';
import { createVehicleSchema, updateVehicleSchema } from './vehicle.validation.js';
import {
  createVehicle,
  getMyVehicles,
  getVehicleById,
  updateVehicle,
  softDeleteVehicle,
} from './vehicle.service.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';

const createHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ownerId = req.user!.id;
    const parsed = createVehicleSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const vehicle = await createVehicle(ownerId, parsed.data);

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: 'Vehicle created successfully',
      data: { vehicle },
    });
  } catch (error) {
    next(error);
  }
};

const getMyVehiclesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user!.id;
    const vehicles = await getMyVehicles(ownerId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Vehicles retrieved successfully',
      data: { vehicles },
    });
  } catch (error) {
    next(error);
  }
};

const getVehicleByIdHandler = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user!.id;
    const vehicleId = req.params.id;
    const vehicle = await getVehicleById(ownerId, vehicleId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Vehicle retrieved successfully',
      data: { vehicle },
    });
  } catch (error) {
    next(error);
  }
};

const updateVehicleHandler = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user!.id;
    const vehicleId = req.params.id;
    const parsed = updateVehicleSchema.safeParse(req.body);

    if (!parsed.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsed.error),
      });
      return;
    }

    const vehicle = await updateVehicle(ownerId, vehicleId, parsed.data);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Vehicle updated successfully',
      data: { vehicle },
    });
  } catch (error) {
    next(error);
  }
};

const softDeleteVehicleHandler = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.user!.id;
    const vehicleId = req.params.id;
    const vehicle = await softDeleteVehicle(ownerId, vehicleId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Vehicle deleted successfully',
      data: { vehicle },
    });
  } catch (error) {
    next(error);
  }
};

export const VehicleController = {
  create: createHandler,
  getMyVehicles: getMyVehiclesHandler,
  getVehicleById: getVehicleByIdHandler,
  updateVehicle: updateVehicleHandler,
  softDeleteVehicle: softDeleteVehicleHandler,
};
