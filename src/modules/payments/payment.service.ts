import { InvoiceStatus, PaymentStatus, Role } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';

export const initiatePayment = async (
  invoiceId: string,
  requestingUserId: string
) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { serviceRequest: true },
  });

  if (!invoice) {
    const err = new Error('Invoice not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  // Existence-leak protection / strict ownership check
  if (invoice.serviceRequest.customerId !== requestingUserId) {
    const err = new Error('Invoice not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  if (invoice.status === InvoiceStatus.PAID) {
    const err = new Error('Invoice is already paid') as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  // Create or update Payment row with gateway: 'SSLCOMMERZ'
  const payment = await prisma.payment.upsert({
    where: { invoiceId: invoice.id },
    update: {
      gateway: 'SSLCOMMERZ',
      amount: invoice.totalAmount,
      status: PaymentStatus.PENDING,
    },
    create: {
      invoiceId: invoice.id,
      gateway: 'SSLCOMMERZ',
      amount: invoice.totalAmount,
      status: PaymentStatus.PENDING,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: requestingUserId },
  });

  const sslUrl = env.sslcommerz.isLive
    ? 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'
    : 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';

  const formData = new URLSearchParams({
    store_id: env.sslcommerz.storeId,
    store_passwd: env.sslcommerz.storePassword,
    total_amount: invoice.totalAmount.toString(),
    currency: 'BDT',
    tran_id: payment.id,
    success_url: env.sslcommerz.successUrl,
    fail_url: env.sslcommerz.failUrl,
    cancel_url: env.sslcommerz.cancelUrl,
    ipn_url: env.sslcommerz.successUrl,
    cus_name: user?.name || 'Customer',
    cus_email: user?.email || 'customer@example.com',
    cus_add1: 'Dhaka',
    cus_add2: 'Dhaka',
    cus_city: 'Dhaka',
    cus_state: 'Dhaka',
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    cus_phone: user?.phone || '01700000000',
    shipping_method: 'NO',
    product_name: `Invoice #${invoice.id}`,
    product_category: 'Service',
    product_profile: 'general',
  });

  const response = await fetch(sslUrl, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const sslData = (await response.json()) as {
    status?: string;
    GatewayPageURL?: string;
    failedreason?: string;
  };

  if (sslData.status === 'SUCCESS' && sslData.GatewayPageURL) {
    return {
      paymentUrl: sslData.GatewayPageURL,
      paymentId: payment.id,
    };
  } else {
    const err = new Error(
      sslData.failedreason || 'Failed to initiate SSLCommerz payment session'
    ) as Error & { statusCode: number };
    err.statusCode = 502;
    throw err;
  }
};

export const handleSuccess = async (payload: Record<string, any>) => {
  const val_id = payload.val_id || payload.val_ID;
  const tran_id = payload.tran_id || payload.tran_ID;

  if (!val_id) {
    const err = new Error('Missing validation ID (val_id) in SSLCommerz payload') as Error & {
      statusCode: number;
    };
    err.statusCode = 400;
    throw err;
  }

  // Validate authenticity via SSLCommerz validation API
  const valBaseUrl = env.sslcommerz.isLive
    ? 'https://securepay.sslcommerz.com'
    : 'https://sandbox.sslcommerz.com';

  const valUrl = `${valBaseUrl}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(
    val_id
  )}&store_id=${encodeURIComponent(
    env.sslcommerz.storeId
  )}&store_passwd=${encodeURIComponent(
    env.sslcommerz.storePassword
  )}&v=1&format=json`;

  const valResponse = await fetch(valUrl);
  const valData = (await valResponse.json()) as {
    status?: string;
    tran_id?: string;
    val_id?: string;
    amount?: string;
    bank_tran_id?: string;
    card_type?: string;
  };

  if (valData.status !== 'VALID' && valData.status !== 'VALIDATED') {
    const err = new Error(
      'Payment validation failed: Invalid transaction from SSLCommerz'
    ) as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  const targetTranId = valData.tran_id || tran_id;

  const payment = await prisma.payment.findFirst({
    where: {
      OR: [{ id: targetTranId }, { transactionId: targetTranId }],
    },
    include: { invoice: true },
  });

  if (!payment) {
    const err = new Error('Payment record not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  // Idempotent: return existing payment if already completed
  if (payment.status === PaymentStatus.COMPLETED && payment.invoice.status === InvoiceStatus.PAID) {
    return { payment, invoice: payment.invoice };
  }

  const transactionId = valData.bank_tran_id || val_id || targetTranId;

  // Transaction updating Payment.status to COMPLETED + transactionId + paidAt AND Invoice.status to PAID
  const [updatedPayment, updatedInvoice] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.COMPLETED,
        transactionId: transactionId,
        paidAt: new Date(),
      },
    }),
    prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        status: InvoiceStatus.PAID,
      },
    }),
  ]);

  return { payment: updatedPayment, invoice: updatedInvoice };
};

export const handleFail = async (payload: Record<string, any>) => {
  const tran_id = payload.tran_id || payload.tran_ID;

  if (tran_id) {
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id: tran_id }, { transactionId: tran_id }],
      },
      include: { invoice: true },
    });

    if (payment && payment.status !== PaymentStatus.COMPLETED) {
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });
      return { payment: updatedPayment, invoice: payment.invoice };
    }

    if (payment) {
      return { payment, invoice: payment.invoice };
    }
  }

  return { message: 'Payment marked as failed' };
};

export const handleCancel = async (payload: Record<string, any>) => {
  const tran_id = payload.tran_id || payload.tran_ID;

  if (tran_id) {
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id: tran_id }, { transactionId: tran_id }],
      },
      include: { invoice: true },
    });

    if (payment && payment.status !== PaymentStatus.COMPLETED) {
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });
      return { payment: updatedPayment, invoice: payment.invoice };
    }

    if (payment) {
      return { payment, invoice: payment.invoice };
    }
  }

  return { message: 'Payment cancelled' };
};

export const getPaymentStatus = async (
  paymentId: string,
  requestingUserId: string,
  requestingRole: string
) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: {
        include: {
          serviceRequest: true,
        },
      },
    },
  });

  if (!payment) {
    const err = new Error('Payment not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const isCustomerOwner = payment.invoice.serviceRequest.customerId === requestingUserId;
  const isAdmin = requestingRole === Role.ADMIN || requestingRole === 'ADMIN';

  if (!isCustomerOwner && !isAdmin) {
    const err = new Error('Payment not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return payment;
};

export const PaymentService = {
  initiatePayment,
  handleSuccess,
  handleFail,
  handleCancel,
  getPaymentStatus,
};
