import { Request, Response, NextFunction } from 'express';
import { MechanicInventoryValidation } from './mechanic-inventory.validation.js';
import { MechanicInventoryService } from './mechanic-inventory.service.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';

const addInventoryItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedBody = MechanicInventoryValidation.addInventoryItemSchema.safeParse(req.body);

    if (!parsedBody.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedBody.error),
      });
      return;
    }

    const mechanicUserId = req.user!.id;
    const inventoryItem = await MechanicInventoryService.addInventoryItem(
      mechanicUserId,
      parsedBody.data
    );

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: 'Inventory item added successfully',
      data: { inventoryItem },
    });
  } catch (error) {
    next(error);
  }
};

const getMyInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedQuery = MechanicInventoryValidation.getInventoryQuerySchema.safeParse(req.query);

    const page = parsedQuery.success ? parsedQuery.data.page : 1;
    const limit = parsedQuery.success ? parsedQuery.data.limit : 10;
    const mechanicUserId = req.user!.id;

    const result = await MechanicInventoryService.getMyInventory(
      mechanicUserId,
      page,
      limit
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Mechanic inventory retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const updateInventoryItem = async (
  req: Request<{ sparePartId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedBody = MechanicInventoryValidation.updateInventoryItemSchema.safeParse(req.body);

    if (!parsedBody.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedBody.error),
      });
      return;
    }

    const mechanicUserId = req.user!.id;
    const sparePartId = req.params.sparePartId;

    const inventoryItem = await MechanicInventoryService.updateInventoryItem(
      mechanicUserId,
      sparePartId,
      parsedBody.data
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Inventory item updated successfully',
      data: { inventoryItem },
    });
  } catch (error) {
    next(error);
  }
};

const restockInventoryItem = async (
  req: Request<{ sparePartId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedBody = MechanicInventoryValidation.restockInventoryItemSchema.safeParse(req.body);

    if (!parsedBody.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedBody.error),
      });
      return;
    }

    const mechanicUserId = req.user!.id;
    const sparePartId = req.params.sparePartId;

    const inventoryItem = await MechanicInventoryService.restockInventoryItem(
      mechanicUserId,
      sparePartId,
      parsedBody.data.quantity
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Inventory item restocked successfully',
      data: { inventoryItem },
    });
  } catch (error) {
    next(error);
  }
};

const removeInventoryItem = async (
  req: Request<{ sparePartId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const mechanicUserId = req.user!.id;
    const sparePartId = req.params.sparePartId;

    const result = await MechanicInventoryService.removeInventoryItem(
      mechanicUserId,
      sparePartId
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

export const MechanicInventoryController = {
  addInventoryItem,
  getMyInventory,
  updateInventoryItem,
  restockInventoryItem,
  removeInventoryItem,
};
