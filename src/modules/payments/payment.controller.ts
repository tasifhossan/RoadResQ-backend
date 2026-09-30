import { Request, Response, NextFunction } from 'express';
import { PaymentValidation } from './payment.validation.js';
import { PaymentService } from './payment.service.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { formatZodError } from '../../utils/formatZodError.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/db.js';

const resolveRequestIdFromPayload = async (
  payload: Record<string, any>
): Promise<{ requestId?: string; invoiceId?: string }> => {
  const tranId = payload.tran_id || payload.tran_ID;
  if (!tranId) return {};

  try {
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id: tranId }, { transactionId: tranId }],
      },
      include: { invoice: true },
    });

    if (payment?.invoice) {
      return {
        requestId: payment.invoice.serviceRequestId,
        invoiceId: payment.invoice.id,
      };
    }
  } catch {
    // Ignore errors during helper fallback lookup
  }

  return {};
};

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

const handleSuccess = async (req: Request, res: Response): Promise<void> => {
  const payload = { ...req.query, ...req.body };
  try {
    const result = await PaymentService.handleSuccess(payload);
    const requestId = result.invoice?.serviceRequestId;
    const invoiceId = result.invoice?.id;

    if (requestId && invoiceId) {
      res.redirect(
        303,
        `${env.frontendUrl}/payment/success?requestId=${encodeURIComponent(requestId)}&invoiceId=${encodeURIComponent(invoiceId)}`
      );
      return;
    }

    res.redirect(303, `${env.frontendUrl}/payment/fail?reason=invalid_request`);
  } catch {
    const { requestId } = await resolveRequestIdFromPayload(payload);
    const reason = 'validation_failed';
    const redirectUrl = requestId
      ? `${env.frontendUrl}/payment/fail?requestId=${encodeURIComponent(requestId)}&reason=${reason}`
      : `${env.frontendUrl}/payment/fail?reason=${reason}`;
    res.redirect(303, redirectUrl);
  }
};

const handleFail = async (req: Request, res: Response): Promise<void> => {
  const payload = { ...req.query, ...req.body };
  try {
    const result = await PaymentService.handleFail(payload);
    const requestId = result?.invoice?.serviceRequestId;
    const reason = 'payment_failed';

    const redirectUrl = requestId
      ? `${env.frontendUrl}/payment/fail?requestId=${encodeURIComponent(requestId)}&reason=${reason}`
      : `${env.frontendUrl}/payment/fail?reason=${reason}`;

    res.redirect(303, redirectUrl);
  } catch {
    const { requestId } = await resolveRequestIdFromPayload(payload);
    const reason = 'payment_failed';
    const redirectUrl = requestId
      ? `${env.frontendUrl}/payment/fail?requestId=${encodeURIComponent(requestId)}&reason=${reason}`
      : `${env.frontendUrl}/payment/fail?reason=${reason}`;
    res.redirect(303, redirectUrl);
  }
};

const handleCancel = async (req: Request, res: Response): Promise<void> => {
  const payload = { ...req.query, ...req.body };
  try {
    const result = await PaymentService.handleCancel(payload);
    const requestId = result?.invoice?.serviceRequestId;

    const redirectUrl = requestId
      ? `${env.frontendUrl}/payment/cancel?requestId=${encodeURIComponent(requestId)}`
      : `${env.frontendUrl}/payment/cancel`;

    res.redirect(303, redirectUrl);
  } catch {
    const { requestId } = await resolveRequestIdFromPayload(payload);
    const redirectUrl = requestId
      ? `${env.frontendUrl}/payment/cancel?requestId=${encodeURIComponent(requestId)}`
      : `${env.frontendUrl}/payment/cancel`;
    res.redirect(303, redirectUrl);
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

const getMyPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedQuery = PaymentValidation.getMyPaymentsQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      sendResponse(res, {
        statusCode: 400,
        success: false,
        message: 'Validation failed',
        errors: formatZodError(parsedQuery.error),
      });
      return;
    }

    const customerId = req.user!.id;
    const result = await PaymentService.getMyPayments(customerId, parsedQuery.data);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Payment history retrieved successfully',
      data: result,
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
  getMyPayments,
};
