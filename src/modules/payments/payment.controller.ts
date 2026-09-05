import { Request, Response, NextFunction } from 'express';
import { PaymentValidation } from './payment.validation.js';
import { PaymentService } from './payment.service.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';

const initiatePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedBody = PaymentValidation.initiatePaymentSchema.safeParse(req.body);

    if (!parsedBody.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedBody.error),
      });
      return;
    }

    const requestingUserId = req.user!.id;

    const result = await PaymentService.initiatePayment(
      parsedBody.data.invoiceId,
      requestingUserId
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Payment session initiated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const handleSuccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = { ...req.query, ...req.body };
    const result = await PaymentService.handleSuccess(payload);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Payment processed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const handleFail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = { ...req.query, ...req.body };
    const result = await PaymentService.handleFail(payload);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Payment failed',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const handleCancel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = { ...req.query, ...req.body };
    const result = await PaymentService.handleCancel(payload);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Payment cancelled',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getPaymentStatus = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const paymentId = req.params.id;
    const requestingUserId = req.user!.id;
    const requestingRole = req.user!.role;

    const payment = await PaymentService.getPaymentStatus(
      paymentId,
      requestingUserId,
      requestingRole
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Payment details retrieved successfully',
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};

export const PaymentController = {
  initiatePayment,
  handleSuccess,
  handleFail,
  handleCancel,
  getPaymentStatus,
};
