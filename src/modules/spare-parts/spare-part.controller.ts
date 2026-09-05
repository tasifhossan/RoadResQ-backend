import { Request, Response, NextFunction } from 'express';
import { SparePartValidation } from './spare-part.validation.js';
import { SparePartService } from './spare-part.service.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';

const createSparePart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedBody = SparePartValidation.createSparePartSchema.safeParse(req.body);

    if (!parsedBody.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedBody.error),
      });
      return;
    }

    const sparePart = await SparePartService.createSparePart(parsedBody.data);

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: 'Catalog spare part created successfully',
      data: { sparePart },
    });
  } catch (error) {
    next(error);
  }
};

const getAllSpareParts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedQuery = SparePartValidation.getSparePartsQuerySchema.safeParse(req.query);

    const page = parsedQuery.success ? parsedQuery.data.page : 1;
    const limit = parsedQuery.success ? parsedQuery.data.limit : 10;
    const search = parsedQuery.success ? parsedQuery.data.search : undefined;

    const result = await SparePartService.getAllSpareParts(page, limit, search);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Catalog spare parts retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getSparePartById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sparePart = await SparePartService.getSparePartById(req.params.id);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Spare part details retrieved successfully',
      data: { sparePart },
    });
  } catch (error) {
    next(error);
  }
};

const updateSparePart = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedBody = SparePartValidation.updateSparePartSchema.safeParse(req.body);

    if (!parsedBody.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedBody.error),
      });
      return;
    }

    const sparePart = await SparePartService.updateSparePart(
      req.params.id,
      parsedBody.data
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Catalog spare part updated successfully',
      data: { sparePart },
    });
  } catch (error) {
    next(error);
  }
};

const softDeleteSparePart = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sparePart = await SparePartService.softDeleteSparePart(req.params.id);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Catalog spare part soft deleted successfully',
      data: { sparePart },
    });
  } catch (error) {
    next(error);
  }
};

export const SparePartController = {
  createSparePart,
  getAllSpareParts,
  getSparePartById,
  updateSparePart,
  softDeleteSparePart,
};
