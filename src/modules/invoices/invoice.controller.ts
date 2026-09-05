import { Request, Response, NextFunction } from 'express';
import { getInvoiceParamsSchema } from './invoice.validation.js';
import { getInvoice as getInvoiceService } from './invoice.service.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';

const getInvoice = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedParams = getInvoiceParamsSchema.safeParse(req.params);

    if (!parsedParams.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedParams.error),
      });
      return;
    }

    const requestingUserId = req.user!.id;
    const requestingRole = req.user!.role;

    const invoice = await getInvoiceService(
      parsedParams.data.id,
      requestingUserId,
      requestingRole
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Invoice retrieved successfully',
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

export const InvoiceController = {
  getInvoice,
};
