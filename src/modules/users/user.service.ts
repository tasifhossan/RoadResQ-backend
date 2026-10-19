import { InvoiceStatus, PaymentStatus, Prisma, RequestStatus } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { UpdateUserInput } from './user.validation.js';

const formatMoney = (val: Prisma.Decimal | number | string | null | undefined): string => {
  if (val === null || val === undefined) return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(val.toString());
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  mechanicProfile: true,
};

/**
 * Retrieves profile information for the authenticated user.
 * Excludes password and soft-deleted users (deletedAt != null).
 * Includes mechanicProfile relation (returns profile if MECHANIC, null if CUSTOMER).
 */
export const getMe = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    select: userSelect,
  });

  if (!user) {
    const err = new Error('User not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  return user;
};

/**
 * Updates profile information (name, phone) for the authenticated user.
 * Ignores restricted fields (email, role).
 */
export const updateMe = async (userId: string, data: UpdateUserInput) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    include: {
      mechanicProfile: true,
    },
  });

  if (!existingUser) {
    const err = new Error('User not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const hasMechanicFields =
    data.bio !== undefined || data.city !== undefined || data.yearsExperience !== undefined;

  if (hasMechanicFields && existingUser.role !== 'MECHANIC') {
    const err = new Error('Only mechanics can update mechanic profile fields') as Error & {
      statusCode: number;
    };
    err.statusCode = 400;
    throw err;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(existingUser.role === 'MECHANIC' &&
        hasMechanicFields && {
          mechanicProfile: {
            upsert: {
              create: {
                bio: data.bio,
                city: data.city,
                yearsExperience: data.yearsExperience,
                skills: [],
              },
              update: {
                ...(data.bio !== undefined && { bio: data.bio }),
                ...(data.city !== undefined && { city: data.city }),
                ...(data.yearsExperience !== undefined && {
                  yearsExperience: data.yearsExperience,
                }),
              },
            },
          },
        }),
    },
    select: userSelect,
  });

  return updatedUser;
};

/**
 * Retrieves summary metrics strictly for the authenticated customer caller.
 * Returns:
 * - requestsByStatus: counts of the caller's service requests grouped by status
 * - spendByMonth: last 6 months zero-filled breakdown of caller's completed/paid payments
 * - totals: requests, completed, totalPaid (formatted money string), unpaidInvoices count
 */
export const getMySummary = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!user) {
    const err = new Error('User not found') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const [requestStatusCounts, paidPaymentAgg, unpaidInvoices, rawSpendByMonth] =
    await Promise.all([
      prisma.serviceRequest.groupBy({
        by: ['status'],
        where: { customerId: userId },
        _count: { status: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.COMPLETED,
          invoice: {
            serviceRequest: {
              customerId: userId,
            },
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.invoice.count({
        where: {
          serviceRequest: {
            customerId: userId,
          },
          status: {
            not: InvoiceStatus.PAID,
          },
        },
      }),
      prisma.$queryRaw<
        Array<{
          month: string;
          amount: string | number;
        }>
      >`
        WITH months AS (
          SELECT to_char(date_trunc('month', m), 'YYYY-MM') AS month,
                 date_trunc('month', m) AS month_start
          FROM generate_series(
            date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
            date_trunc('month', CURRENT_DATE),
            INTERVAL '1 month'
          ) AS m
        )
        SELECT 
          m.month,
          COALESCE(SUM(p."amount"), 0)::text AS amount
        FROM months m
        LEFT JOIN (
          "Payment" p
          JOIN "Invoice" inv ON p."invoiceId" = inv."id"
          JOIN "ServiceRequest" sr ON inv."serviceRequestId" = sr."id"
        ) ON to_char(date_trunc('month', COALESCE(p."paidAt", p."createdAt")), 'YYYY-MM') = m.month 
          AND p."status" = 'COMPLETED' 
          AND sr."customerId" = ${userId}
        GROUP BY m.month, m.month_start
        ORDER BY m.month_start ASC;
      `,
    ]);

  const requestsByStatus: Record<RequestStatus, number> = {
    [RequestStatus.PENDING]: 0,
    [RequestStatus.SEARCHING]: 0,
    [RequestStatus.ASSIGNED]: 0,
    [RequestStatus.EN_ROUTE]: 0,
    [RequestStatus.ARRIVED]: 0,
    [RequestStatus.IN_PROGRESS]: 0,
    [RequestStatus.COMPLETED]: 0,
    [RequestStatus.CANCELLED]: 0,
  };

  for (const item of requestStatusCounts) {
    requestsByStatus[item.status] = item._count.status;
  }

  const totals = {
    requests: Object.values(requestsByStatus).reduce((sum, count) => sum + count, 0),
    completed: requestsByStatus[RequestStatus.COMPLETED],
    totalPaid: formatMoney(paidPaymentAgg._sum.amount),
    unpaidInvoices,
  };

  const spendByMonth = rawSpendByMonth.map((m) => ({
    month: m.month,
    amount: formatMoney(m.amount),
  }));

  return {
    requestsByStatus,
    spendByMonth,
    totals,
  };
};

export const UserService = { getMe, updateMe, getMySummary };

